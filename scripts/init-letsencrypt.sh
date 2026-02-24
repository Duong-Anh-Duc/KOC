#!/bin/bash
# =============================================================================
# scripts/init-letsencrypt.sh
# Khởi tạo chứng chỉ SSL Let's Encrypt lần đầu cho koc-scraper.com
#
# Chạy một lần duy nhất khi deploy lần đầu:
#   chmod +x scripts/init-letsencrypt.sh
#   ./scripts/init-letsencrypt.sh
# =============================================================================

set -e

# ─── Cấu hình ─────────────────────────────────────────────────
DOMAINS=("koc-scraper.com" "www.koc-scraper.com")
EMAIL="ducytcg123456@gmail.com"          # ← Đổi thành email thật của bạn
STAGING=0                               # 1 = test (không giới hạn request), 0 = production

RSA_KEY_SIZE=4096
DATA_PATH="./certbot"
NGINX_CONF="./nginx/default.conf"

# ─── Màu sắc terminal ────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}### KOC Scraper – Khởi tạo Let's Encrypt SSL ###${NC}"

# ─── Kiểm tra certbot data path ───────────────────────────────
if [ -d "$DATA_PATH" ]; then
  read -p "Thư mục certbot đã tồn tại. Tiếp tục và ghi đè? (y/N) " decision
  if [ "$decision" != "Y" ] && [ "$decision" != "y" ]; then
    echo "Hủy."
    exit 1
  fi
fi

# ─── Tải options-ssl-nginx.conf và ssl-dhparams.pem ─────────
if [ ! -e "$DATA_PATH/conf/options-ssl-nginx.conf" ] || [ ! -e "$DATA_PATH/conf/ssl-dhparams.pem" ]; then
  echo -e "${YELLOW}### Tải recommended TLS parameters...${NC}"
  mkdir -p "$DATA_PATH/conf"
  curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot-nginx/certbot_nginx/_internal/tls_configs/options-ssl-nginx.conf \
    > "$DATA_PATH/conf/options-ssl-nginx.conf"
  curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot/certbot/ssl-dhparams.pem \
    > "$DATA_PATH/conf/ssl-dhparams.pem"
  echo
fi

# ─── Tạo chứng chỉ giả để nginx có thể khởi động ────────────
echo -e "${YELLOW}### Tạo chứng chỉ tự ký tạm thời cho ${DOMAINS[0]}...${NC}"
DOMAIN_PATH="$DATA_PATH/conf/live/${DOMAINS[0]}"
mkdir -p "$DOMAIN_PATH"
docker compose run --rm --entrypoint "\
  openssl req -x509 -nodes -newkey rsa:$RSA_KEY_SIZE -days 1 \
    -keyout '/etc/letsencrypt/live/${DOMAINS[0]}/privkey.pem' \
    -out '/etc/letsencrypt/live/${DOMAINS[0]}/fullchain.pem' \
    -subj '/CN=localhost'" certbot
echo

# ─── Khởi động nginx ──────────────────────────────────────────
echo -e "${YELLOW}### Khởi động nginx...${NC}"
docker compose up --force-recreate -d nginx
echo

# ─── Xóa chứng chỉ giả ───────────────────────────────────────
echo -e "${YELLOW}### Xóa chứng chỉ tạm...${NC}"
docker compose run --rm --entrypoint "\
  rm -Rf /etc/letsencrypt/live/${DOMAINS[0]} && \
  rm -Rf /etc/letsencrypt/archive/${DOMAINS[0]} && \
  rm -Rf /etc/letsencrypt/renewal/${DOMAINS[0]}.conf" certbot
echo

# ─── Xin chứng chỉ thật từ Let's Encrypt ────────────────────
echo -e "${YELLOW}### Xin chứng chỉ thật từ Let's Encrypt...${NC}"

# Ghép các domain thành --domain flags
DOMAIN_ARGS=""
for domain in "${DOMAINS[@]}"; do
  DOMAIN_ARGS="$DOMAIN_ARGS -d $domain"
done

# Chọn staging hay production
if [ $STAGING != "0" ]; then
  STAGING_ARG="--staging"
else
  STAGING_ARG=""
fi

docker compose run --rm --entrypoint "\
  certbot certonly --webroot -w /var/www/certbot \
    $STAGING_ARG \
    $DOMAIN_ARGS \
    --email $EMAIL \
    --rsa-key-size $RSA_KEY_SIZE \
    --agree-tos \
    --force-renewal" certbot
echo

# ─── Reload nginx để dùng chứng chỉ thật ────────────────────
echo -e "${YELLOW}### Reload nginx...${NC}"
docker compose exec nginx nginx -s reload

echo -e "${GREEN}### ✅ Hoàn tất! SSL đã được kích hoạt cho:${NC}"
for domain in "${DOMAINS[@]}"; do
  echo -e "   https://$domain"
done
echo
echo -e "${YELLOW}Certbot sẽ tự động gia hạn cert mỗi 12 giờ.${NC}"
