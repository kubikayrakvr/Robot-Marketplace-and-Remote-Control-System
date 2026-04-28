FROM python:3.13-slim

# Sistem bağımlılıklarını kur (psycopg2 ve anahtarlar için)
RUN apt-get update && apt-get install -y \
    libpq-dev \
    gcc \
    openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Bağımlılıkları yükle
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Proje dosyalarını kopyala
COPY . .

# Eğer anahtarlar yoksa otomatik üret (Siber güvenlik önlemi)
RUN if [ ! -f private.pem ]; then \
    openssl genrsa -out private.pem 2048 && \
    openssl rsa -in private.pem -outform PEM -pubout -out public.pem; \
    fi

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
