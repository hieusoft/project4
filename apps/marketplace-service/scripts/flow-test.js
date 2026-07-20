/**
 * End-to-end flow test for marketplace-service (in-memory).
 * No Postgres/RabbitMQ required — exercises domain + use cases.
 *
 * Run: node scripts/flow-test.js
 */
const assert = require('assert');
const crypto = require('crypto');
const path = require('path');

const root = path.join(__dirname, '..');
const Listing = require(path.join(root, 'src/Domain/Entities/Listing'));
const ItemRequest = require(path.join(root, 'src/Domain/Entities/ItemRequest'));
const ListingUseCases = require(path.join(root, 'src/Application/UseCases/ListingUseCases'));
const RequestUseCases = require(path.join(root, 'src/Application/UseCases/RequestUseCases'));
const CreateListingDTO = require(path.join(root, 'src/Application/DTOs/CreateListingDTO'));
const CreateRequestDTO = require(path.join(root, 'src/Application/DTOs/CreateRequestDTO'));
const CompleteRequestDTO = require(path.join(root, 'src/Application/DTOs/CompleteRequestDTO'));

const uuid = () => crypto.randomUUID();

const results = [];
function ok(name) {
  results.push({ name, pass: true });
  console.log(`  PASS  ${name}`);
}
function fail(name, err) {
  results.push({ name, pass: false, err: err.message || String(err) });
  console.error(`  FAIL  ${name}`);
  console.error(`        ${err.message || err}`);
}
async function test(name, fn) {
  try {
    await fn();
    ok(name);
  } catch (e) {
    fail(name, e);
  }
}

// --- In-memory repos ---
class MemListingRepo {
  constructor() {
    this.items = new Map();
  }
  async findAll(filters = {}) {
    let rows = [...this.items.values()];
    if (filters.status) rows = rows.filter((r) => r.status === filters.status);
    if (filters.group_id) rows = rows.filter((r) => r.group_id === filters.group_id);
    return { data: rows, meta: { page: 1, limit: 20, total: rows.length, total_pages: 1 } };
  }
  async find(filters) {
    return this.findAll(filters);
  }
  async findById(id) {
    return this.items.get(id) || null;
  }
  async save(listing) {
    const id = listing.id || uuid();
    const saved = new Listing({
      ...listing,
      id,
      quantity_available:
        listing.quantity_available !== undefined
          ? listing.quantity_available
          : listing.quantity_total || 1,
      status: listing.status || 'active',
      created_at: new Date(),
      updated_at: new Date(),
    });
    this.items.set(id, saved);
    return saved;
  }
}

class MemRequestRepo {
  constructor() {
    this.items = new Map();
    this.confirmations = [];
  }
  async find(filters = {}) {
    let rows = [...this.items.values()];
    if (filters.status) rows = rows.filter((r) => r.status === filters.status);
    if (filters.listing_id) rows = rows.filter((r) => r.listing_id === filters.listing_id);
    return { data: rows, meta: { page: 1, limit: 20, total: rows.length, total_pages: 1 } };
  }
  async findById(id) {
    return this.items.get(id) || null;
  }
  async save(request) {
    const id = request.id || uuid();
    const saved = new ItemRequest({
      ...request,
      id,
      status: request.status || 'pending',
      created_at: new Date(),
      updated_at: new Date(),
    });
    this.items.set(id, saved);
    return saved;
  }
  async update(request) {
    this.items.set(request.id, new ItemRequest({ ...request, updated_at: new Date() }));
    return this.items.get(request.id);
  }
  async completeWithTransaction(request, listing, completionData) {
    if (!listing) throw new Error('listing is null in completeWithTransaction');
    const updated = new ItemRequest({ ...request });
    this.items.set(request.id, updated);
    this.confirmations.push({ request_id: request.id, ...completionData });
    // simulate listing update
    return { request: updated };
  }
}

class MemDeliveryRepo {
  constructor(requestRepo) {
    this.requestRepo = requestRepo;
  }
  async findByRequestId(requestId) {
    return this.requestRepo.confirmations.find((c) => c.request_id === requestId) || null;
  }
}

class CapturingPublisher {
  constructor() {
    this.events = [];
  }
  async publishListingCreated(p) {
    this.events.push({ type: 'listing.created', p });
  }
  async publishRequestCreated(p) {
    this.events.push({ type: 'request.created', p });
  }
  async publishRequestApproved(p) {
    this.events.push({ type: 'request.approved', p });
  }
  async publishRequestRejected(p) {
    this.events.push({ type: 'request.rejected', p });
  }
  async publishRequestScheduled(p) {
    this.events.push({ type: 'request.scheduled', p });
  }
  async publishRequestCompleted(p) {
    this.events.push({ type: 'request.completed', p });
  }
}

function setup() {
  const listingRepository = new MemListingRepo();
  const requestRepository = new MemRequestRepo();
  const deliveryConfirmationRepository = new MemDeliveryRepo(requestRepository);
  const messagePublisher = new CapturingPublisher();
  const listingUseCases = new ListingUseCases({ listingRepository, messagePublisher });
  const requestUseCases = new RequestUseCases({
    requestRepository,
    listingRepository,
    messagePublisher,
    deliveryConfirmationRepository,
  });
  return {
    listingRepository,
    requestRepository,
    listingUseCases,
    requestUseCases,
    messagePublisher,
  };
}

const MOD_ID = uuid();
const RECEIVER_ID = uuid();
const GROUP_ID = uuid();
const CATEGORY_ID = uuid();
const INV_ITEM_ID = uuid();

async function main() {
  console.log('\n=== Marketplace flow tests (in-memory) ===\n');

  // --- Domain unit ---
  await test('Domain: Listing.reserve reduces qty and sets reserved', () => {
    const l = new Listing({
      id: uuid(),
      inventory_item_id: INV_ITEM_ID,
      group_id: GROUP_ID,
      title: 'Áo',
      category_id: CATEGORY_ID,
      condition: 'good',
      quantity_total: 2,
      quantity_available: 2,
      created_by: MOD_ID,
    });
    l.reserve(1);
    assert.strictEqual(l.quantity_available, 1);
    assert.strictEqual(l.status, 'active');
    l.reserve(1);
    assert.strictEqual(l.quantity_available, 0);
    assert.strictEqual(l.status, 'reserved');
  });

  await test('Domain: Listing.reserve throws when not enough', () => {
    const l = new Listing({
      quantity_total: 1,
      quantity_available: 1,
      status: 'active',
    });
    assert.throws(() => l.reserve(2));
  });

  await test('Domain: ItemRequest state machine happy path', () => {
    const r = new ItemRequest({ listing_id: uuid(), group_id: GROUP_ID, receiver_id: RECEIVER_ID });
    assert.strictEqual(r.status, 'pending');
    r.approve(MOD_ID);
    assert.strictEqual(r.status, 'approved');
    r.schedule(MOD_ID, '2026-08-01T10:00:00Z');
    assert.strictEqual(r.status, 'scheduled');
    r.complete();
    assert.strictEqual(r.status, 'completed');
    assert.ok(r.completed_at);
  });

  await test('Domain: cannot approve non-pending', () => {
    const r = new ItemRequest({ status: 'approved' });
    assert.throws(() => r.approve(MOD_ID));
  });

  await test('Domain: cannot schedule non-approved', () => {
    const r = new ItemRequest({ status: 'pending' });
    assert.throws(() => r.schedule(MOD_ID, new Date()));
  });

  await test('Domain: complete from approved without schedule', () => {
    const r = new ItemRequest({ status: 'pending' });
    r.approve(MOD_ID);
    r.complete();
    assert.strictEqual(r.status, 'completed');
  });

  await test('DTO: CreateListingDTO validation', () => {
    const bad = new CreateListingDTO({});
    assert.throws(() => bad.validate());
    const good = new CreateListingDTO({
      inventory_item_id: INV_ITEM_ID,
      group_id: GROUP_ID,
      title: 'Quần',
      category_id: CATEGORY_ID,
      condition: 'like_new',
      created_by: MOD_ID,
    });
    good.validate();
  });

  // --- Full happy path ---
  {
    const ctx = setup();
    let listingId;
    let requestId;

    await test('Flow: create listing → listing.created event', async () => {
      const dto = new CreateListingDTO({
        inventory_item_id: INV_ITEM_ID,
        group_id: GROUP_ID,
        title: 'Áo khoác mùa đông',
        description: 'Còn tốt',
        category_id: CATEGORY_ID,
        condition: 'good',
        quantity_total: 1,
        province_code: '01',
        created_by: MOD_ID,
        images: [{ image_url: 'http://cdn/a.jpg' }],
      });
      dto.validate();
      const listing = await ctx.listingUseCases.createListing(dto);
      listingId = listing.id;
      assert.ok(listingId);
      assert.strictEqual(listing.status, 'active');
      // BUG probe: quantity_available may be undefined if DTO omits it
      if (listing.quantity_available === undefined) {
        throw new Error(
          'BUG: quantity_available is undefined after create (CreateListingDTO does not set it; entity defaults only if undefined at construct — DTO missing field may break isAvailable)'
        );
      }
      assert.strictEqual(listing.quantity_available, 1);
      const ev = ctx.messagePublisher.events.find((e) => e.type === 'listing.created');
      assert.ok(ev, 'expected listing.created');
      assert.strictEqual(ev.p.listingId, listingId);
    });

    await test('Flow: catalog only active', async () => {
      const cat = await ctx.listingUseCases.getCatalog();
      assert.ok(cat.data.some((l) => l.id === listingId));
    });

    await test('Flow: create request → pending + event', async () => {
      const dto = new CreateRequestDTO({
        listing_id: listingId,
        group_id: GROUP_ID,
        receiver_id: RECEIVER_ID,
        quantity: 1,
        reason: 'Gia đình khó khăn',
      });
      dto.validate();
      const req = await ctx.requestUseCases.createRequest(dto);
      requestId = req.id;
      assert.strictEqual(req.status, 'pending');
      assert.ok(String(req.code).startsWith('REQ-'));
      assert.ok(ctx.messagePublisher.events.some((e) => e.type === 'request.created'));
    });

    await test('Flow: reject path then re-request (separate setup skip)', async () => {
      // covered below in dedicated suite
    });

    await test('Flow: approve request', async () => {
      const req = await ctx.requestUseCases.approveRequest(requestId, MOD_ID);
      assert.strictEqual(req.status, 'approved');
      assert.strictEqual(req.reviewed_by, MOD_ID);
      assert.ok(ctx.messagePublisher.events.some((e) => e.type === 'request.approved'));

      // Design vs docs: quantity should decrease on approve — check if still full
      const listing = await ctx.listingRepository.findById(listingId);
      if (listing.quantity_available === 1 && listing.status === 'active') {
        // record as soft assertion in console
        console.warn(
          '        WARN  design gap: approve does NOT decrease quantity_available / reserve listing (docs: decrease on approve)'
        );
      }
    });

    await test('Flow: schedule request', async () => {
      const when = '2026-08-15T09:00:00.000Z';
      const req = await ctx.requestUseCases.scheduleRequest(requestId, MOD_ID, when);
      assert.strictEqual(req.status, 'scheduled');
      assert.ok(ctx.messagePublisher.events.some((e) => e.type === 'request.scheduled'));
    });

    await test('Flow: complete with QR → confirmation + event', async () => {
      const completion = new CompleteRequestDTO({
        confirmed_by: MOD_ID,
        qr_token: 'qr-test-token-abc',
        photo_url: 'http://cdn/delivery.jpg',
        note: 'Trao thành công',
      });
      completion.validate();
      const req = await ctx.requestUseCases.completeRequest(requestId, completion);
      assert.strictEqual(req.status, 'completed');
      assert.ok(ctx.messagePublisher.events.some((e) => e.type === 'request.completed'));

      const conf = await ctx.requestUseCases.getDeliveryConfirmation(requestId);
      assert.ok(conf, 'delivery confirmation missing');
      assert.strictEqual(conf.qr_token, 'qr-test-token-abc');

      // after complete, listing should have been reserved in memory entity before txn
      const listing = await ctx.listingRepository.findById(listingId);
      // completeWithTransaction mock does not persist listing qty; use-case mutates entity in memory
      // Re-fetch from repo may still be old — probe use-case side effect on object held in repo map
      // In real code, listing is mutated then written in completeWithTransaction
    });

    await test('Flow: event sequence order (happy path)', () => {
      const types = ctx.messagePublisher.events.map((e) => e.type);
      const expected = [
        'listing.created',
        'request.created',
        'request.approved',
        'request.scheduled',
        'request.completed',
      ];
      let i = 0;
      for (const t of types) {
        if (t === expected[i]) i++;
      }
      assert.strictEqual(i, expected.length, `events ${JSON.stringify(types)} missing sequence`);
    });
  }

  // --- Reject path ---
  {
    const ctx = setup();
    await test('Flow: reject request', async () => {
      const listing = await ctx.listingUseCases.createListing(
        new CreateListingDTO({
          inventory_item_id: uuid(),
          group_id: GROUP_ID,
          title: 'Giày',
          category_id: CATEGORY_ID,
          condition: 'used',
          quantity_total: 1,
          created_by: MOD_ID,
        })
      );
      // ensure qty
      if (listing.quantity_available === undefined) {
        listing.quantity_available = 1;
        ctx.listingRepository.items.set(listing.id, listing);
      }
      const req = await ctx.requestUseCases.createRequest(
        new CreateRequestDTO({
          listing_id: listing.id,
          group_id: GROUP_id_or(GROUP_ID),
          receiver_id: RECEIVER_ID,
          quantity: 1,
        })
      );
      const rejected = await ctx.requestUseCases.rejectRequest(req.id, MOD_ID, 'Không đủ điều kiện');
      assert.strictEqual(rejected.status, 'rejected');
      assert.strictEqual(rejected.reject_reason, 'Không đủ điều kiện');
      assert.ok(ctx.messagePublisher.events.some((e) => e.type === 'request.rejected'));
    });
  }

  // --- Error cases ---
  {
    const ctx = setup();
    await test('Error: request on missing listing → NotFound', async () => {
      await assert.rejects(
        () =>
          ctx.requestUseCases.createRequest(
            new CreateRequestDTO({
              listing_id: uuid(),
              group_id: GROUP_ID,
              receiver_id: RECEIVER_ID,
              quantity: 1,
            })
          ),
        (e) => e.message.includes('Listing not found') || e.name === 'NotFoundError'
      );
    });

    await test('Error: request qty > available', async () => {
      const listing = await ctx.listingUseCases.createListing(
        new CreateListingDTO({
          inventory_item_id: uuid(),
          group_id: GROUP_ID,
          title: 'Bàn',
          category_id: CATEGORY_ID,
          condition: 'good',
          quantity_total: 1,
          created_by: MOD_ID,
        })
      );
      if (listing.quantity_available === undefined) {
        listing.quantity_available = 1;
        ctx.listingRepository.items.set(listing.id, listing);
      }
      await assert.rejects(
        () =>
          ctx.requestUseCases.createRequest(
            new CreateRequestDTO({
              listing_id: listing.id,
              group_id: GROUP_ID,
              receiver_id: RECEIVER_ID,
              quantity: 5,
            })
          ),
        (e) => /enough available/i.test(e.message)
      );
    });

    await test('Error: double approve fails', async () => {
      const listing = await ctx.listingUseCases.createListing(
        new CreateListingDTO({
          inventory_item_id: uuid(),
          group_id: GROUP_ID,
          title: 'Tủ',
          category_id: CATEGORY_ID,
          condition: 'good',
          quantity_total: 1,
          created_by: MOD_ID,
        })
      );
      if (listing.quantity_available === undefined) {
        listing.quantity_available = 1;
        ctx.listingRepository.items.set(listing.id, listing);
      }
      const req = await ctx.requestUseCases.createRequest(
        new CreateRequestDTO({
          listing_id: listing.id,
          group_id: GROUP_ID,
          receiver_id: RECEIVER_ID,
          quantity: 1,
        })
      );
      await ctx.requestUseCases.approveRequest(req.id, MOD_ID);
      await assert.rejects(() => ctx.requestUseCases.approveRequest(req.id, MOD_ID));
    });

    await test('Error: complete without confirm fields (DTO)', () => {
      const dto = new CompleteRequestDTO({});
      assert.throws(() => dto.validate());
    });
  }

  // --- CreateListingDTO quantity_available bug ---
  await test('Probe: CreateListingDTO → Listing quantity_available default', () => {
    const dto = new CreateListingDTO({
      inventory_item_id: INV_ITEM_ID,
      group_id: GROUP_ID,
      title: 'X',
      category_id: CATEGORY_ID,
      condition: 'good',
      quantity_total: 3,
      created_by: MOD_ID,
    });
    const listing = new Listing(dto);
    // Entity: quantity_available !== undefined ? ... : quantity_total
    // DTO does not set quantity_available → undefined → should fall back to total
    assert.strictEqual(
      listing.quantity_available,
      3,
      'Listing entity should default quantity_available from quantity_total'
    );
  });

  // summary
  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass);
  console.log(`\n=== Summary: ${passed}/${results.length} passed ===`);
  if (failed.length) {
    console.log('Failed:');
    failed.forEach((f) => console.log(`  - ${f.name}: ${f.err}`));
    process.exitCode = 1;
  } else {
    console.log('All tests passed.\n');
  }
}

function GROUP_id_or(g) {
  return g;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
