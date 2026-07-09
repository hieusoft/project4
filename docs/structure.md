charity-platform/
├── README.md
├── .gitignore
├── .env                                # biến môi trường local
├── .env.example                        # mẫu biến chung: JWT_SECRET, R2 keys, LLM keys...
├── Dockerfile
├── docker-compose.yml                  # full stack: kong + services + infra
├── docker-compose.infra.yml            # dev local: chỉ postgres, redis, rabbitmq
│
├── infra/
│   ├── kong/
│   │   └── kong.yml                    # declarative config: routes, jwt, cors, rate-limit
│   ├── docs-portal/                    # Swagger UI hub multi-spec → Kong /docs
│   │   ├── Dockerfile
│   │   ├── nginx.conf
│   │   ├── index.html
│   │   └── swagger-config.json         # danh sách openapi.json từng service
│   ├── postgres/
│   │   └── init/
│   │       └── 01-create-databases.sql # tạo database cho các service
│   └── rabbitmq/
│       └── definitions.json            # khai báo sẵn exchanges, queues

│
├── libs/
│   ├── tsconfig.base.json              # cấu hình TypeScript dùng chung cho libs/apps JS/TS
│   ├── common/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── tsconfig.build.json
│   │   └── src/
│   │       ├── index.ts
│   │       ├── decorators/
│   │       ├── guards/
│   │       ├── filters/
│   │       ├── interceptors/
│   │       ├── dto/
│   │       ├── enums/
│   │       └── utils/
│   │
│   ├── events/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── tsconfig.build.json
│   │   └── src/
│   │       ├── index.ts
│   │       ├── rabbitmq.module.ts
│   │       ├── event-names.ts
│   │       └── contracts/
│   │
│   └── clients/
│       ├── package.json
│       ├── tsconfig.json
│       ├── tsconfig.build.json
│       └── src/
│           ├── index.ts
│           ├── http-client.base.ts
│           ├── community.client.ts
│           ├── marketplace.client.ts
│           ├── donation.client.ts
│           └── media.client.ts
│
├── apps/                                # applications/services, mỗi app tự giữ package/config riêng
│   ├── identity-service/
│   ├── community-service/
│   ├── donation-service/
│   ├── marketplace-service/
│   ├── communication-service/
│   ├── media-service/
│   └── ai-service/
│
└── docs/
    ├── architecture.md
    ├── database.md
    ├── flows.md
    ├── erd/
    └── api/
