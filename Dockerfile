FROM oven/bun:1

WORKDIR /app

COPY package.json bun.lock ./

RUN bun install

COPY . .

ENV NODE_ENV=development
RUN bun lint

USER bun
EXPOSE 3000/tcp
CMD [ "bun", "run" ,"dev" ]