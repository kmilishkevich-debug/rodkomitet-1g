// Публичный VAPID-ключ для веб-пушей (он и должен быть публичным —
// браузер использует его, чтобы привязать подписку к нашему серверу).
export const VAPID_PUBLIC_KEY =
  "BI0sm6Q9dwWSvjfn8F_hoXMe2HmSYvOLazmIapx8OVt1O8tNbuipOEhqClrcxZZhRzIxjGIO4ej4dq0lA9N8HJQ";

// Почта-контакт для пуш-службы (требование стандарта VAPID)
export const VAPID_SUBJECT = "mailto:k.milishkevich@gmail.com";
