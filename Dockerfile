FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

ARG VITE_SUPABASE_URL=
ARG VITE_SUPABASE_ANON_KEY=
ARG VITE_GUNA_EMR_BASE_URL=
ARG VITE_CDSS_BASE_URL=

ENV VITE_SUPABASE_URL=${VITE_SUPABASE_URL}
ENV VITE_SUPABASE_ANON_KEY=${VITE_SUPABASE_ANON_KEY}
ENV VITE_GUNA_EMR_BASE_URL=${VITE_GUNA_EMR_BASE_URL}
ENV VITE_CDSS_BASE_URL=${VITE_CDSS_BASE_URL}

RUN npm run build

FROM nginx:1.27-alpine

RUN apk add --no-cache nodejs

WORKDIR /app

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
COPY --from=build /app/backend /app/backend
COPY --from=build /app/node_modules /app/node_modules

ENV PORT=3001

EXPOSE 80

CMD ["/bin/sh", "-c", "node /app/backend/guna_emr/converter-agent/index.js & exec nginx -g 'daemon off;'"]