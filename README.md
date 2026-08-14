# Genky

Hệ thống quản lý nhân sự (HRM) — Laravel API + Next.js Web + Flutter Mobile.

## Cấu trúc

```
genky/
├── api/      # Laravel 12 API
├── web/      # Next.js (dashboard HRM Pro)
└── mobile/   # Flutter app
```

## Chạy dự án

### API (Laravel)

```bash
cd api
composer install
php -d upload_max_filesize=8M -d post_max_size=12M artisan serve
```

API dashboard: `http://127.0.0.1:8000/api/dashboard`

### Web (Next.js)

```bash
cd web
npm install
npm run dev
```

Mở: `http://localhost:3000`

### Mobile (Flutter)

Cần cài Flutter SDK trước, sau đó:

```bash
cd mobile
flutter pub get
flutter run
```

## Kiến trúc API

Web (`https://genky.vn`) và mobile cùng gọi một URL:

```
https://api.genky.vn/api
```

Không dùng `https://genky.vn/api`.

## Biến môi trường

`web/.env.local` (máy dev):

```
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000/api
```

Build production trên host:

```
NEXT_PUBLIC_API_URL=https://api.genky.vn/api
```
