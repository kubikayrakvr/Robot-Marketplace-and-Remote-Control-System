#!/bin/bash

DB_CONTAINER="sat0_postgres"
DB_USER="user"
DB_NAME="robot_db"
THRESHOLD=5            # 10 dakika içindeki hata sınırı
WINDOW="10 minutes"    # Kontrol edilecek zaman aralığı
MY_IP="49.13.13.48" # BURAYA KENDİ IP ADRESİNİ YAZ (Banlanmamak için)

echo "[$(date)] --- Siber Güvenlik Analizi Başlatıldı ---"

# 1. Veritabanından Şüpheli IP'leri Çek
# Şüpheli eylemler: Yetkisiz erişim, Hız sınırı aşımı, Başarısız girişler
BAD_IPS=$(docker exec -i $DB_CONTAINER psql -U $DB_USER -d $DB_NAME -t -c \
"SELECT ip_address FROM audit_logs 
 WHERE (action LIKE '%UNAUTHORIZED%' OR action LIKE '%LIMIT%' OR action LIKE '%FAILED%') 
 AND timestamp > NOW() - INTERVAL '$WINDOW' 
 AND ip_address IS NOT NULL 
 GROUP BY ip_address 
 HAVING COUNT(*) >= $THRESHOLD;")

# 2. IP'leri Analiz Et ve Yasakla
for IP in $BAD_IPS; do
    # Boşlukları temizle
    IP=$(echo $IP | tr -d '[:space:]')

    # Beyaz liste kontrolü (Kendi IP'ni banlama!)
    if [ "$IP" == "$MY_IP" ]; then
        echo " [?]   UYARI: Kendi IP adresin ($IP) şüpheli görünüyor ama atlanıyor."
        continue
    fi

    # IP'nin zaten banlı olup olmadığını kontrol et
    if ! iptables -L DOCKER-USER -n | grep -q "$IP"; then
        echo "[!]   SALDIRI TESPİT EDİLDİ: $IP adresi sunucu seviyesinde engelleniyor..."
        
        # Docker-User zincirine en üstten (Index 1) ekle
        iptables -I DOCKER-USER -s $IP -j DROP
        
        # Sistem loguna (syslog) raporla
        logger -t ROBOT_SOC "SHIELD: IP $IP banned after $THRESHOLD suspicious activities."
    else
        echo "[i]   $IP zaten banlı durumda."
    fi
done

echo "[$(date)] --- Analiz Tamamlandı ---"
# chmod +x ~/Robot-Marketplace-and-Remote-Control-System/scripts/ban_malicious_ips.sh
# crontab aç: crontab -e
# en alta ekle: */5 * * * * /bin/bash /root/Robot-Marketplace-and-Remote-Control-System/scripts/ban_malicious_ips.sh >> /var/log/robot_security.log 2>&1
