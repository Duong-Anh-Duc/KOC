# /etc/nginx/sites-available/koc-scraper.com
# Deploy vào VPS bằng lệnh:
#   scp nginx/koc-scraper.com root@46.62.170.132:/etc/nginx/sites-available/koc-scraper.com
#   ssh root@46.62.170.132 "ln -sf /etc/nginx/sites-available/koc-scraper.com /etc/nginx/sites-enabled/ && nginx -t && systemctl reload nginx"

server {
    listen 80;
    server_name koc-scraper.com www.koc-scraper.com;

    # Certbot ACME challenge
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    # Redirect HTTP → HTTPS
    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name koc-scraper.com www.koc-scraper.com;

    ssl_certificate     /etc/letsencrypt/live/koc-scraper.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/koc-scraper.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # Security headers
    add_header X-Frame-Options        "SAMEORIGIN"                    always;
    add_header X-Content-Type-Options "nosniff"                       always;
    add_header X-XSS-Protection       "1; mode=block"                 always;
    add_header Referrer-Policy        "strict-origin-when-cross-origin" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml image/svg+xml;
    gzip_min_length 1024;

    # ── /api/* → KOC backend server (port 3002) ─────────────
    location /api/ {
        proxy_pass         http://127.0.0.1:3002/api/;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade            $http_upgrade;
        proxy_set_header   Connection         'upgrade';
        proxy_set_header   Host               $host;
        proxy_set_header   X-Real-IP          $remote_addr;
        proxy_set_header   X-Forwarded-For    $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto  $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 600s;
        proxy_send_timeout 600s;
        client_max_body_size 20m;
    }

    # ── /* → KOC frontend client (port 3090) ────────────────
    location / {
        proxy_pass        http://127.0.0.1:3090;
        proxy_http_version 1.1;
        proxy_set_header  Host              $host;
        proxy_set_header  X-Real-IP         $remote_addr;
        proxy_set_header  X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header  X-Forwarded-Proto $scheme;
    }
}
