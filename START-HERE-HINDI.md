# Pehle yeh padhein — Booyahstudio final setup

**MANISH KUMAR SONKAR | FF ONLINE SHOP | Booyahstudio**  
GSTIN: 09JALPS3433P1ZP

## Kahan kya milega

- `booyahstudio/`: poora GitHub/Vercel project.
- `booyahstudio/docs/policies/`: har policy alag Markdown page mein, copy karne ke liye.
- `private-product-uploads/`: customer ko dene wali ZIP files; Supabase ke private bucket mein upload karein.
- `booyahstudio/supabase/schema.sql`: Supabase SQL Editor mein chalana hai.
- `booyahstudio/.env.example`: required keys ke naam. Real keys ZIP/GitHub mein nahi dalni.
- `booyahstudio/DEPLOYMENT.md`: har setting ki detailed instructions.

## Step by step

1. ZIP extract karein. `booyahstudio/` ke andar ke files apne GitHub repository mein upload/push karein.
2. Supabase project banayein. SQL Editor mein `supabase/schema.sql` run karein.
3. Supabase Storage ka `products` bucket **private** rakhein. `private-product-uploads/` ki ZIPs exact filename ke saath upload karein. `product-images` sirf public thumbnails ke liye hai.
4. Supabase Auth mein email/password aur email confirmation on karein. Site URL aur allowed redirects apne domain ke set karein.
5. Resend mein apna sending domain verify karein. Supabase Auth SMTP mein Resend SMTP details set karein. Password-reset template ka exact link DEPLOYMENT.md se copy karein.
6. Razorpay Test keys banayein. Webhook URL `/api/payments/razorpay/webhook` rakhein. `payment.captured`, `order.paid`, `refund.processed` events enable karein. Automatic capture setting check karein.
7. Vercel par GitHub repo import karein. Node 24.x, build `pnpm build`, output `dist`. Environment Variables mein `.env.example` wale naam aur apni actual values set karein. `APP_URL` final HTTPS domain hoga.
8. Deploy/redeploy karein. Signup, confirmation email, login aur forgot-password test karein. Test payment se real download unlock nahi hota.
9. Apna owner account confirm karke ek baar login karein. Uska Supabase UUID lekar DEPLOYMENT.md wali SQL command se admin role set karein. Phir `/admin` kholein.
10. Live payment se pehle tax rate/SAC, invoice process, har product ka license aur files confirm karein. Current app payment receipt banata hai, tax invoice nahi.
11. Razorpay account approval ke baad Vercel Production mein Live keys aur matching webhook secret set karein. Controlled real purchase, file download, email aur refund check karein.

## Zaroori baatein

Domain abhi repository ka `www.booyahstudio.shop` rakha gaya hai. Agar aapka domain alag hai to DEPLOYMENT.md ke domain-change steps follow karein.

Private API secrets ko kabhi `VITE_` prefix na dein. Customer ZIPs `public/` folder mein na rakhein. Sirf browser mein “success” dikhne se download nahi milta; server Razorpay se captured payment verify karta hai.

Support: connectbooyahstudio@gmail.com · WhatsApp 7393845435. Actual provider account setup aur live verification owner ko apne accounts mein karna hai. Is package se site automatically live nahi hoti.

## Is updated ZIP mein kya naya hai

- `FINAL-AUDIT.md` mein 66 requirement areas ka BEFORE/AFTER comparison aur tests hain.
- Pehle se Supabase database hai to backup lekar `supabase/migrations/20261005_payment_security.sql` run karein. Naya database ho to `supabase/schema.sql` run karein.
- Razorpay webhook ki updated event list `DEPLOYMENT.md` section 5 se select karein. URL: `https://www.booyahstudio.shop/api/payments/razorpay/webhook` (apne actual domain ke hisab se badlein).
- Resend sender/domain aur Supabase custom SMTP dono alag configure karne hain. Sirf API key add karne se password-reset email setup poora nahi hota.
- Admin mein account suspend/restore, order access review aur dispute evidence download milta hai. Refund Razorpay Dashboard se review karke karein.
- Local automated tests provider responses simulate karte hain. Aapke account par real payment, actual email inbox aur live Supabase Storage abhi verify nahi hue. Live launch se pehle deployment guide ke checks karein.
- ZIP mein actual website source, SQL, policies aur private upload ZIPs hain; `node_modules`, build output aur secret keys nahi hain.

**GitHub repository PRIVATE rakhein.** Owner project mein paid product source files bhi hain; public GitHub repo banane se ye files sabko dikhengi. Final ZIP ko public website asset na banayein.
