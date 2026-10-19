# CVR 3D Print Lab — V2.2 Payment Build

This build adds a manual UPI payment workflow to the working V2.1 Supabase application.

## What changed

- Custom print: Quote accepted -> Awaiting Payment.
- Existing catalogue product: fixed-price order -> Awaiting Payment.
- Customer sees the approved amount, configured UPI ID and a **Pay via UPI** button.
- Customer submits the UPI transaction / UTR reference after payment.
- Order becomes **Payment Submitted**.
- Admin can review the reference and click **Verify payment**.
- Verified orders become **Paid**, then can move to Printing -> Ready -> Completed.
- Admin can reject a wrong payment reference so the customer can submit again.
- UPI ID, payee name and payment enable/disable switch are controlled from Admin -> Pricing.

## IMPORTANT — upgrade an existing V2/V2.1 Supabase project

Do NOT run the full schema again on your existing project.

Run only `payment-migration.sql` once:

1. Supabase Dashboard -> SQL Editor.
2. New query.
3. Open `payment-migration.sql` from this folder.
4. Copy all its contents into Supabase.
5. Click Run.
6. You should get a success message.

## Update the website

Keep your existing `config.js` with your Supabase Project URL and Publishable Key. You can either copy that file into this V2.2 folder or paste the same two values into the V2.2 `config.js`.

Then test V2.2 locally with Live Server.

## Configure UPI

1. Admin -> Pricing.
2. Under **UPI payment settings**, enter the lab/college-approved UPI ID.
3. Enter the payee/lab name.
4. Tick **Enable customer UPI payments**.
5. Save payment & pricing settings.

Do not use a personal payment account unless the college/lab has explicitly approved it.

## Test workflow

1. Submit a Custom Print order.
2. Admin sets weight, print time and quote.
3. Customer tracks order and accepts quote.
4. Tracking becomes Awaiting Payment.
5. Customer pays through UPI and selects **I have paid**.
6. Customer enters the UPI transaction/UTR reference.
7. Admin -> Orders -> View -> Verify payment.
8. Order becomes Paid.
9. Admin changes status to Printing, Ready and Completed as work progresses.

For an Existing Design, the fixed product amount goes directly to Awaiting Payment because no custom quotation is needed.

## Deployment

After local testing, redeploy this V2.2 folder to Vercel. Make sure `config.js` contains only the Supabase Project URL and Publishable Key. Never put a Supabase Secret key or service_role key in the frontend.
