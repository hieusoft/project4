/**
 * Marketplace domain/use-case flow tests (in-memory).
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

class MemListingRepo {
  constructor() {
    this.items = new Map();
  }
  async findAll(filters = {}) {
    let rows = [...this.items.values()];
    if (filters.status) rows = rows.filter((r) => r.status === filters.status);
    if (filters.available_only) {
      rows = rows.filter((r) => r.quantity_available > 0);
    }
    return { data: rows, meta: { page: 1, limit: 20, total: rows.length, total_pages: 1 } };
  }
  async find(f) {
    return this.findAll(f);
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
    });
    this.items.set(id, saved);
    return saved;
  }
  async update(listing) {
    this.items.set(listing.id, new Listing({ ...listing }));
    return this.items.get(listing.id);
  }
}

class MemRequestRepo {
  constructor(listingRepository) {
    this.listingRepository = listingRepository;
    this.items = new Map();
    this.confirmations = [];
  }
  async find() {
    return { data: [...this.items.values()], meta: {} };
  }
  async findById(id) {
    return this.items.get(id) || null;
  }
  async save(request) {
    const id = request.id || uuid();
    const saved = new ItemRequest({ ...request, id, status: request.status || 'pending' });
    this.items.set(id, saved);
    return saved;
  }
  async update(request) {
    this.items.set(request.id, new ItemRequest({ ...request }));
    return this.items.get(request.id);
  }
  async approveWithListing(request) {
    const listing = await this.listingRepository.findById(request.listing_id);
    if (!listing || !listing.isAvailable(request.quantity)) {
      throw new Error('Listing does not have enough available quantity');
    }
    listing.reserve(request.quantity);
    this.items.set(request.id, new ItemRequest({ ...request }));
    return { request: this.items.get(request.id), listing };
  }
  async updateWithListing(request, listing) {
    this.items.set(request.id, new ItemRequest({ ...request }));
    return this.items.get(request.id);
  }
  async completeWithTransaction(request, listing, completionData) {
    this.items.set(request.id, new ItemRequest({ ...request }));
    this.confirmations.push({ request_id: request.id, ...completionData });
    const hasOpenReservations = [...this.items.values()].some(
      (item) =>
        item.listing_id === request.listing_id &&
        ['approved', 'scheduled'].includes(item.status)
    );
    listing.finalizeDelivery(hasOpenReservations);
    return { request: this.items.get(request.id), listing };
  }
}

class MemDeliveryRepo {
  constructor(rr) {
    this.rr = rr;
  }
  async findByRequestId(id) {
    return this.rr.confirmations.find((c) => c.request_id === id) || null;
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

class FakeCommunity {
  constructor({ members = {}, mods = {} } = {}) {
    this.members = members;
    this.mods = mods;
  }
  async verifyMembership(userId, groupId) {
    const key = `${groupId}:${userId}`;
    return { approved: !!this.members[key], role: this.members[key] || null };
  }
  async isModerator(userId, groupId) {
    return !!this.mods[`${groupId}:${userId}`];
  }
}

class FakeDonation {
  constructor(items = {}) {
    this.items = items;
    this.updates = [];
  }
  async getInventoryItem(id) {
    return this.items[id] || null;
  }
  async updateItemStatus(id, status, ref) {
    this.updates.push({ id, status, ref });
    if (this.items[id]) this.items[id].status = status;
    return this.items[id];
  }
}

const MOD_ID = uuid();
const RECEIVER_ID = uuid();
const SECOND_RECEIVER_ID = uuid();
const GROUP_ID = uuid();
const CAT_ID = uuid();
const INV_ID = uuid();

function setup(extra = {}) {
  const listingRepository = new MemListingRepo();
  const requestRepository = new MemRequestRepo(listingRepository);
  const messagePublisher = new CapturingPublisher();
  const communityClient =
    extra.community ||
    new FakeCommunity({
      members: {
        [`${GROUP_ID}:${RECEIVER_ID}`]: 'member',
        [`${GROUP_ID}:${SECOND_RECEIVER_ID}`]: 'member',
        [`${GROUP_ID}:${MOD_ID}`]: 'owner',
      },
      mods: { [`${GROUP_ID}:${MOD_ID}`]: true },
    });
  const donationClient =
    extra.donation ||
    new FakeDonation({
      [INV_ID]: {
        id: INV_ID,
        status: 'in_stock',
        group_id: GROUP_ID,
        name: 'Ao',
        category_id: CAT_ID,
        condition: 'good',
        quantity: 1,
      },
    });

  const listingUseCases = new ListingUseCases({
    listingRepository,
    messagePublisher,
    donationClient,
    communityClient,
  });
  const requestUseCases = new RequestUseCases({
    requestRepository,
    listingRepository,
    messagePublisher,
    deliveryConfirmationRepository: new MemDeliveryRepo(requestRepository),
    donationClient,
    communityClient,
  });
  return { listingRepository, requestRepository, listingUseCases, requestUseCases, messagePublisher, donationClient };
}

async function main() {
  console.log('\n=== Marketplace flow tests (updated design) ===\n');

  await test('Domain: reserve on approve pattern + release', () => {
    const l = new Listing({ quantity_total: 2, quantity_available: 2, status: 'active' });
    l.reserve(1);
    assert.strictEqual(l.quantity_available, 1);
    l.reserve(1);
    assert.strictEqual(l.status, 'reserved');
    l.release(1);
    assert.strictEqual(l.quantity_available, 1);
    assert.strictEqual(l.status, 'active');
    l.reserve(1);
    l.finalizeDelivery();
    assert.strictEqual(l.status, 'closed');
  });

  await test('Catalog hides legacy active listings with zero quantity', async () => {
    const ctx = setup();
    const listing = await ctx.listingRepository.save(
      new Listing({
        inventory_item_id: INV_ID,
        group_id: GROUP_ID,
        title: 'Legacy sold out',
        category_id: CAT_ID,
        condition: 'good',
        quantity_total: 1,
        quantity_available: 0,
        status: 'active',
        created_by: MOD_ID,
      })
    );
    assert.strictEqual(listing.status, 'active');
    const catalog = await ctx.listingUseCases.getCatalog({});
    assert.strictEqual(catalog.data.length, 0);
  });

  await test('Domain: cancel / no_show state', () => {
    const r = new ItemRequest({ status: 'pending' });
    r.approve(MOD_ID);
    r.schedule(MOD_ID, '2026-08-01');
    r.noShow(MOD_ID);
    assert.strictEqual(r.status, 'no_show');
    const r2 = new ItemRequest({ status: 'pending' });
    r2.approve(MOD_ID);
    r2.cancel(RECEIVER_ID);
    assert.strictEqual(r2.status, 'cancelled');
  });

  {
    const ctx = setup();
    let listingId;
    let requestId;

    await test('Create listing verifies inventory + marks listed', async () => {
      const dto = new CreateListingDTO({
        inventory_item_id: INV_ID,
        group_id: GROUP_ID,
        title: 'Ao E2E',
        category_id: CAT_ID,
        condition: 'good',
        quantity_total: 1,
        created_by: MOD_ID,
      });
      const listing = await ctx.listingUseCases.createListing(dto, { userId: MOD_ID });
      listingId = listing.id;
      assert.strictEqual(listing.quantity_available, 1);
      assert.ok(ctx.donationClient.updates.some((u) => u.status === 'listed'));
      assert.ok(ctx.messagePublisher.events.some((e) => e.type === 'listing.created'));
    });

    await test('Create request requires membership', async () => {
      const stranger = uuid();
      await assert.rejects(
        () =>
          ctx.requestUseCases.createRequest(
            new CreateRequestDTO({
              listing_id: listingId,
              group_id: GROUP_ID,
              receiver_id: stranger,
              quantity: 1,
            }),
            { userId: stranger }
          ),
        (e) => e.statusCode === 403 || /Tham gia|member/i.test(e.message)
      );
    });

    await test('Create request OK for member', async () => {
      const req = await ctx.requestUseCases.createRequest(
        new CreateRequestDTO({
          listing_id: listingId,
          group_id: GROUP_ID,
          receiver_id: RECEIVER_ID,
          quantity: 1,
        }),
        { userId: RECEIVER_ID }
      );
      requestId = req.id;
      assert.strictEqual(req.status, 'pending');
    });

    await test('Approve decreases quantity_available', async () => {
      const req = await ctx.requestUseCases.approveRequest(requestId, MOD_ID, { userId: MOD_ID });
      assert.strictEqual(req.status, 'approved');
      const listing = await ctx.listingRepository.findById(listingId);
      assert.strictEqual(listing.quantity_available, 0);
      assert.strictEqual(listing.status, 'reserved');
      assert.ok(ctx.donationClient.updates.some((u) => u.status === 'reserved'));
    });

    await test('Schedule + complete without double-reserve', async () => {
      await ctx.requestUseCases.scheduleRequest(requestId, MOD_ID, '2026-08-20T10:00:00Z');
      await assert.rejects(
        () =>
          ctx.requestUseCases.completeRequest(
            requestId,
            new CompleteRequestDTO({
              confirmed_by: MOD_ID,
              qr_token: 'REQ-WRONG',
            }),
            { userId: MOD_ID }
          ),
        /QR code does not match/
      );
      const scheduledRequest = await ctx.requestRepository.findById(requestId);
      const completion = new CompleteRequestDTO({
        confirmed_by: MOD_ID,
        qr_token: scheduledRequest.code,
      });
      const req = await ctx.requestUseCases.completeRequest(requestId, completion, {
        userId: MOD_ID,
      });
      assert.strictEqual(req.status, 'completed');
      const listing = await ctx.listingRepository.findById(listingId);
      assert.strictEqual(listing.quantity_available, 0);
      assert.strictEqual(listing.status, 'closed');
      assert.ok(ctx.donationClient.updates.some((u) => u.status === 'delivered'));
    });
  }

  {
    const ctx = setup();
    await test('Partial delivery keeps remaining stock active and listed', async () => {
      const listing = await ctx.listingUseCases.createListing(
        new CreateListingDTO({
          inventory_item_id: INV_ID,
          group_id: GROUP_ID,
          title: 'Ao so luong nhieu',
          category_id: CAT_ID,
          condition: 'good',
          quantity_total: 3,
          created_by: MOD_ID,
        }),
        { userId: MOD_ID }
      );
      const request = await ctx.requestUseCases.createRequest(
        new CreateRequestDTO({
          listing_id: listing.id,
          receiver_id: RECEIVER_ID,
          quantity: 1,
        }),
        { userId: RECEIVER_ID }
      );
      await ctx.requestUseCases.approveRequest(request.id, MOD_ID);
      let current = await ctx.listingRepository.findById(listing.id);
      assert.strictEqual(current.quantity_available, 2);
      assert.strictEqual(current.status, 'active');

      await ctx.requestUseCases.completeRequest(
        request.id,
        new CompleteRequestDTO({ confirmed_by: MOD_ID, qr_token: request.code }),
        { userId: MOD_ID }
      );
      current = await ctx.listingRepository.findById(listing.id);
      assert.strictEqual(current.quantity_available, 2);
      assert.strictEqual(current.status, 'active');
      assert.strictEqual(ctx.donationClient.updates.at(-1).status, 'listed');
    });
  }

  {
    const ctx = setup();
    await test('Last open reservation closes a sold-out listing', async () => {
      const listing = await ctx.listingUseCases.createListing(
        new CreateListingDTO({
          inventory_item_id: INV_ID,
          group_id: GROUP_ID,
          title: 'Hai ao',
          category_id: CAT_ID,
          condition: 'good',
          quantity_total: 2,
          created_by: MOD_ID,
        }),
        { userId: MOD_ID }
      );
      const first = await ctx.requestUseCases.createRequest(
        new CreateRequestDTO({
          listing_id: listing.id,
          receiver_id: RECEIVER_ID,
          quantity: 1,
        }),
        { userId: RECEIVER_ID }
      );
      const second = await ctx.requestUseCases.createRequest(
        new CreateRequestDTO({
          listing_id: listing.id,
          receiver_id: SECOND_RECEIVER_ID,
          quantity: 1,
        }),
        { userId: SECOND_RECEIVER_ID }
      );
      await ctx.requestUseCases.approveRequest(first.id, MOD_ID);
      await ctx.requestUseCases.approveRequest(second.id, MOD_ID);

      await ctx.requestUseCases.completeRequest(
        first.id,
        new CompleteRequestDTO({ confirmed_by: MOD_ID, qr_token: first.code }),
        { userId: MOD_ID }
      );
      let current = await ctx.listingRepository.findById(listing.id);
      assert.strictEqual(current.quantity_available, 0);
      assert.strictEqual(current.status, 'reserved');
      assert.strictEqual(ctx.donationClient.updates.at(-1).status, 'reserved');

      await ctx.requestUseCases.completeRequest(
        second.id,
        new CompleteRequestDTO({ confirmed_by: MOD_ID, qr_token: second.code }),
        { userId: MOD_ID }
      );
      current = await ctx.listingRepository.findById(listing.id);
      assert.strictEqual(current.status, 'closed');
      assert.strictEqual(ctx.donationClient.updates.at(-1).status, 'delivered');
    });
  }

  {
    const ctx = setup();
    await test('Cancel after approve restores qty', async () => {
      const listing = await ctx.listingUseCases.createListing(
        new CreateListingDTO({
          inventory_item_id: INV_ID,
          group_id: GROUP_ID,
          title: 'Giay',
          category_id: CAT_ID,
          condition: 'good',
          quantity_total: 1,
          created_by: MOD_ID,
        }),
        { userId: MOD_ID }
      );
      const req = await ctx.requestUseCases.createRequest(
        new CreateRequestDTO({
          listing_id: listing.id,
          receiver_id: RECEIVER_ID,
          quantity: 1,
        }),
        { userId: RECEIVER_ID }
      );
      await ctx.requestUseCases.approveRequest(req.id, MOD_ID);
      let l = await ctx.listingRepository.findById(listing.id);
      assert.strictEqual(l.quantity_available, 0);
      await ctx.requestUseCases.cancelRequest(req.id, { userId: RECEIVER_ID });
      l = await ctx.listingRepository.findById(listing.id);
      assert.strictEqual(l.quantity_available, 1);
      assert.strictEqual(l.status, 'active');
    });
  }

  {
    const ctx = setup();
    await test('No-show restores qty', async () => {
      const listing = await ctx.listingUseCases.createListing(
        new CreateListingDTO({
          inventory_item_id: INV_ID,
          group_id: GROUP_ID,
          title: 'Ban',
          category_id: CAT_ID,
          condition: 'good',
          quantity_total: 1,
          created_by: MOD_ID,
        }),
        { userId: MOD_ID }
      );
      const req = await ctx.requestUseCases.createRequest(
        new CreateRequestDTO({
          listing_id: listing.id,
          receiver_id: RECEIVER_ID,
          quantity: 1,
        }),
        { userId: RECEIVER_ID }
      );
      await ctx.requestUseCases.approveRequest(req.id, MOD_ID);
      await ctx.requestUseCases.scheduleRequest(req.id, MOD_ID, '2026-09-01');
      await ctx.requestUseCases.noShowRequest(req.id, MOD_ID);
      const l = await ctx.listingRepository.findById(listing.id);
      assert.strictEqual(l.quantity_available, 1);
      const r = await ctx.requestRepository.findById(req.id);
      assert.strictEqual(r.status, 'no_show');
    });
  }

  {
    const ctx = setup();
    await test('Close listing', async () => {
      const listing = await ctx.listingUseCases.createListing(
        new CreateListingDTO({
          inventory_item_id: INV_ID,
          group_id: GROUP_ID,
          title: 'Tu',
          category_id: CAT_ID,
          condition: 'good',
          quantity_total: 1,
          created_by: MOD_ID,
        }),
        { userId: MOD_ID }
      );
      const closed = await ctx.listingUseCases.closeListing(listing.id, { userId: MOD_ID });
      assert.strictEqual(closed.status, 'closed');
    });
  }

  {
    const ctx = setup({
      donation: new FakeDonation({
        [INV_ID]: { id: INV_ID, status: 'delivered', group_id: GROUP_ID },
      }),
    });
    await test('Reject listing if inventory not in_stock', async () => {
      await assert.rejects(
        () =>
          ctx.listingUseCases.createListing(
            new CreateListingDTO({
              inventory_item_id: INV_ID,
              group_id: GROUP_ID,
              title: 'X',
              category_id: CAT_ID,
              condition: 'good',
              created_by: MOD_ID,
            }),
            { userId: MOD_ID }
          ),
        (e) => /in_stock/i.test(e.message)
      );
    });
  }

  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass);
  console.log(`\n=== Summary: ${passed}/${results.length} passed ===`);
  if (failed.length) {
    failed.forEach((f) => console.log(`  - ${f.name}: ${f.err}`));
    process.exitCode = 1;
  } else {
    console.log('All tests passed.\n');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
