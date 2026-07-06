# Dockerfile do frontend — Nginx servindo arquivos estáticos + proxy para a API
FROM nginx:alpine

# Remove a configuração padrão do Nginx e coloca a nossa
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copia todos os arquivos do app para a pasta servida pelo Nginx
COPY index.html api.js manifest.json sw.js /usr/share/nginx/html/

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
