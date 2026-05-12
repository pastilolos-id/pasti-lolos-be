# Notifikasi — kontrak singkat untuk FE

Base path: `GET|PATCH|DELETE /notifications` (JWT wajib).

## REST

| Aksi | Method | Path | Catatan |
|------|--------|------|---------|
| Daftar | GET | `/notifications?page=1&limit=20` | Query opsional: `unreadOnly=true` |
| Unread badge | GET | `/notifications/unread-count` | `{ unreadCount: number }` |
| Detail / buka + baca sekaligus | GET | `/notifications/:id?markRead=true` | Tanpa `markRead` hanya baca data; `markRead=true` set `isRead` jika belum dibaca |
| Tandai satu dibaca | PATCH | `/notifications/:id/read` | Sama dengan detail + mark read (response payload notifikasi) |
| Tandai semua dibaca | PATCH | `/notifications/read-all` | |
| Hapus | DELETE | `/notifications/:id` | |

Response satu item / list item: `{ id, userId, title, message, type, link, isRead, createdAt }` (ISO string untuk `createdAt`).

## WebSocket (`/notifications` namespace)

- Event **`notification`**: notifikasi baru (payload sama seperti REST item).
- Event **`notification:read`**:
  - `{ id, isRead: true }` — satu item jadi dibaca;
  - `{ allRead: true }` — setelah `PATCH .../read-all` (FE bisa set badge 0 atau refetch `unread-count`).

Auth: token di `auth.token` (Socket.IO) atau header `Authorization: Bearer ...` (sama seperti koneksi yang sudah ada).
