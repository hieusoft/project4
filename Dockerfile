FROM node:24-alpine AS app
WORKDIR /app

ARG SERVICE_PATH
COPY libs ./libs
COPY apps ./apps

RUN npm install --prefix libs/common \
  && npm run build --prefix libs/common \
  && npm install --prefix libs/events \
  && npm run build --prefix libs/events \
  && npm install --prefix libs/clients \
  && npm run build --prefix libs/clients

WORKDIR /app/${SERVICE_PATH}
RUN npm install
RUN npm run build
CMD ["npm", "start"]
