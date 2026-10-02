import type React from 'react';
import { BUSINESS } from '../config/business';

export interface PolicySection {
  id: string;
  title: string;
  content: string | React.ReactNode;
}

export interface Policy {
  slug: string;
  title: string;
  subtitle: string;
  lastUpdated: string;
  quickSummary: string[];
  sections: PolicySection[];
}

const contactDetails = `${BUSINESS.name}\n${BUSINESS.address}\nEmail: ${BUSINESS.email}\nPhone: ${BUSINESS.phone}\nSupport Hours: ${BUSINESS.supportHours}`;

function createPolicy(
  slug: string,
  title: string,
  summary: string[],
  sections: [string, string][]
): Policy {
  return {
    slug,
    title,
    subtitle: `${BUSINESS.name} · ${BUSINESS.url}`,
    lastUpdated: 'October 2, 2026',
    quickSummary: summary,
    sections: [...sections, ['Contact Us & Support', contactDetails]].map(([heading, content], i) => ({
      id: `${slug}-${i + 1}`,
      title: heading,
      content,
    })),
  };
}

export const SUPPORTED_POLICY_SLUGS = [
  'terms',
  'privacy',
  'refund',
  'cancellation',
  'delivery',
  'chargebacks',
  'grievance',
  'license',
] as const;

export type SupportedPolicySlug = (typeof SUPPORTED_POLICY_SLUGS)[number];

export const POLICY_REDIRECTS: Record<string, SupportedPolicySlug> = {
  'shipping-delivery': 'delivery',
  'shipping': 'delivery',
  'digital-delivery': 'delivery',
  'cookies': 'privacy',
  'cookies-browser-storage': 'privacy',
  'cookie-policy': 'privacy',
  'security': 'privacy',
  'account-security': 'privacy',
  'fraud': 'terms',
  'fraud-prevention': 'terms',
  'acceptable-use': 'terms',
  'content': 'terms',
  'content-policy': 'terms',
  'product-content': 'terms',
  'disclaimer': 'terms',
  'product-disclaimer': 'terms',
  'ip-copyright': 'license',
  'copyright': 'license',
  'contact-support': 'grievance',
  'grievance-support': 'grievance',
  'complaints': 'grievance',
  'disputes': 'chargebacks',
  'chargeback': 'chargebacks',
  'dispute-policy': 'chargebacks',
  'refund-return': 'refund',
  'refund-policy': 'refund',
  'returns': 'refund',
  'return': 'refund',
  'cancel': 'cancellation',
  'cancellations': 'cancellation',
  'policy-directory': 'terms',
  'all-policies': 'terms',
  'policies': 'terms',
};

export const policyData: Record<SupportedPolicySlug, Policy> = {
  terms: createPolicy(
    'terms',
    'Terms & Conditions',
    [
      'Official agreement governing digital website templates, source code packages and online checkout.',
      'Electronic delivery by email and account download vault upon confirmed payment.',
      'Comprehensive rules for acceptable use, account security, fraud prevention, licensing and statutory rights.',
    ],
    [
      [
        'Who these terms apply to',
        `${BUSINESS.name} operates the digital storefront at ${BUSINESS.url}. These terms govern all browsing, account registration, orders, digital downloads, and support interactions. Please read these terms alongside our Privacy Policy, Refund & Return Policy, Cancellation Policy, Digital Delivery Policy, and Product License. If a product listing contains specific written technical requirements or prerequisites, those terms form part of your agreement for that product. Contact us at ${BUSINESS.email} before ordering if any description or policy term is unclear.`,
      ],
      [
        'Eligibility, account registration and security',
        `You must be legally competent to enter into binding agreements and authorized to use your chosen payment method. Minors must use the store only under parental or legal guardian supervision. When creating an account, you must provide an accurate name, email address, and 10-digit mobile number.
Account credentials must be kept strictly confidential. We protect passwords using salted bcrypt cryptographic hashing and secure your authenticated session with opaque, HTTP-only session cookies. You are responsible for all activity conducted through your credentials. Never disclose your password to anyone; store support will never ask for your password, OTP, CVV, or UPI PIN. If you suspect unauthorized access or compromised credentials, notify us immediately at ${BUSINESS.email} so we can secure your account.`,
      ],
      [
        'Acceptable use and prohibited conduct',
        `You may use this website to explore products, make authorized purchases, manage customer orders, and access licensed digital downloads. You agree to use the store and all delivered packages in full compliance with applicable laws and the Product License.
You must not:
1. Attempt unauthorized access to other customer accounts, internal server routes, databases, or API infrastructure.
2. Circumvent or manipulate download tokens, security checks, rate limits, or payment verification workflows.
3. Use automated bots, scrapers, or excessive requests that degrade storefront performance.
4. Distribute, resell, sublicense, or share restricted template source files or one-time download links publicly.
5. Provide fraudulent payment details, submit forged transaction references, or abuse complaint and chargeback mechanisms.
6. Use our contact or support channels for harassment, spam, threats, or transmitting malicious code.
We reserve the right to suspend or restrict accounts or access tokens involved in credible security breaches or abuse, while providing a prompt opportunity to respond through support.`,
      ],
      [
        'What you are buying and product scope',
        `Our products are downloadable website templates, React code packages, UI components, and software resources. Before purchasing, carefully review the listing details, included pages, technical dependencies, component documentation, screenshots, and live previews.
A live preview illustrates frontend design, layout, and simulated interface interactions. Hosting, custom domain registration, ongoing maintenance, third-party API keys, and custom backend integrations are not included unless expressly stated in the listing. You are responsible for ensuring your development environment meets the disclosed technical prerequisites (such as Node.js, React, or Vite versions). Undisclosed material defects or misleading descriptions remain fully protected under our Refund & Return Policy.`,
      ],
      [
        'Demo content, trademarks and third-party references',
        `Store previews and demo websites may incorporate illustrative text, placeholder data, fictional company names, and sample photography. These examples are provided solely to demonstrate layout and visual structure; they do not represent real commercial endorsements, active businesses, or verified customer reviews.
Before publishing a website built with a purchased template, you must replace all sample copy, placeholder data, and logos with your own accurate, lawful content. References to third-party technologies, frameworks, or brand names exist solely to identify compatibility and context; all trademarks remain the property of their respective owners.`,
      ],
      [
        'Prices, currency and checkout',
        `Store checkout supports customers in India and displays all prices in Indian Rupees (INR). The checkout summary clearly shows all items, applied promotional discounts, and the final order total before you authorize payment. We never add shipping fees or surprise delivery surcharges.
Valid coupon codes apply only to qualifying purchases as defined in their promotional terms. Price adjustments or promotions published after an order is placed do not apply retroactively to completed purchases.`,
      ],
      [
        'Order creation, payment verification and fraud prevention',
        `Submitting an order or opening a payment gateway page does not establish that payment has been completed. An order is confirmed only after our backend verifies captured payment from an approved payment provider (Easebuzz, PayU, or Paddle) matching the exact order reference and amount.
To protect against payment fraud and protect digital assets, we verify transaction signatures and payment references server-side before generating digital download tokens. A payment that cannot be reconciled to an active order remains pending while investigated. If your account was debited but your order remains pending, contact us at ${BUSINESS.email} with your transaction reference before re-attempting checkout.`,
      ],
      [
        'Digital delivery and access',
        `All delivery is 100% electronic; no physical goods are shipped. Following verified payment, we send an order confirmation containing secure, single-use download links to your registered email address. Digital downloads and tax invoices also become available within your authenticated My Account portal. Delivery typically occurs within 5 minutes. Full details, token limits, and link expiration rules are set forth in our Digital Delivery Policy.`,
      ],
      [
        'Product license and permitted use',
        `Purchasing a digital package grants you a non-exclusive, non-transferable license to customize and use the source code for one personal or client end-project, as detailed in our Product License. Copyright and intellectual property ownership in the underlying template code remain with ${BUSINESS.name}. You may not resell, redistribute, or package the source code as a competing digital product or stock template.`,
      ],
      [
        'Cancellation, refunds and dispute rights',
        `You may request cancellation of an order before digital delivery commences. Because electronic delivery is initiated promptly following payment confirmation, cancellation requests must be communicated immediately. Once digital access or download links have been delivered, change-of-mind refunds are generally unavailable; however, non-delivery, duplicate charges, wrong files, and unresolved material defects remain fully eligible for review under our Refund & Return Policy. You always retain the right to approach your bank or payment institution regarding any transaction.`,
      ],
      [
        'Support scope and service availability',
        `Standard support covers order status inquiries, download assistance, clarifying product documentation, and addressing verified file defects. Custom feature development, bespoke design modifications, third-party software debugging, and server hosting configuration are outside standard purchase support.
While we maintain high storefront availability, temporary maintenance or external service interruptions may occur. We work diligently to resolve interruptions and protect paid customer orders. Planned maintenance does not extinguish customer delivery or refund rights.`,
      ],
      [
        'Limitation of liability and consumer protection',
        `We do not guarantee specific commercial outcomes, sales figures, search engine rankings, or payment provider approvals resulting from your use of our templates. To the fullest extent permitted by applicable law, our total liability for any claim arising from a product purchase is limited to the amount actually paid for that product.
Nothing in these terms limits or excludes statutory consumer rights, mandatory warranty protections, or legal remedies that cannot be lawfully waived under Indian law, including the Consumer Protection Act, 2019. Mandatory consumer protections take precedence over any conflicting term herein.`,
      ],
      [
        'Governing law, grievance redressal and amendments',
        `These terms are governed by the laws of India. Any disputes arising in connection with the storefront are subject to the jurisdiction of competent courts or consumer forums in Prayagraj, Uttar Pradesh, India, without prejudice to mandatory statutory consumer venues.
We may update these terms periodically to reflect operational, technical, or legal changes. Updates will be posted on this page with a revised effective date. Existing completed orders remain governed by the terms in effect at the time of purchase.`,
      ],
    ]
  ),

  privacy: createPolicy(
    'privacy',
    'Privacy Policy',
    [
      'How BOOYAH STUDIO collects, uses, and safeguards personal information for digital storefront operations.',
      'Full disclosure of essential cookies and local storage; zero third-party advertising or tracking cookies.',
      'Transparent data retention, strict access controls, and customer rights under Indian privacy regulations.',
    ],
    [
      [
        'Scope and data controller',
        `This Privacy Policy explains how ${BUSINESS.name} (${BUSINESS.address}) collects, stores, processes, and protects your personal data when you browse ${BUSINESS.url}, create an account, purchase digital templates, or contact our support team.
We act as the data controller for customer records collected through this storefront. We do not sell, rent, or trade your personal information to third parties for marketing purposes.`,
      ],
      [
        'Information we collect',
        `We collect only the information necessary to provide storefront services, process orders, and comply with legal requirements:
1. Account Information: Name, email address, 10-digit mobile number, encrypted password hash, and company/country details you choose to provide.
2. Order & Billing Details: Purchased items, order totals, discount codes, currency (INR), payment method, transaction IDs from payment gateways, invoice records, and delivery timestamps. We never store full debit/credit card numbers, CVVs, OTPs, or UPI PINs.
3. Technical & Usage Data: IP address, device type, browser user-agent, session timestamps, and download token redemption logs to verify order ownership and prevent fraud.
4. Support Communications: Messages, bug reports, and correspondence submitted via email or contact forms.`,
      ],
      [
        'Cookies, login sessions and browser storage',
        `Our storefront uses only essential first-party cookies and local storage to deliver core functionality. We do not use third-party advertising, profiling, or cross-site tracking cookies.
1. Opaque Session Cookie ('sid'): When you register or log in, our server issues an HTTP-only, secure, sameSite=lax session cookie containing an opaque cryptographic token. This cookie authenticates your session for up to 7 days, allowing you to access My Account, order history, and digital downloads without re-entering credentials on every page. It is invalidated upon logout.
2. Browser Local Storage: We use your browser's local storage to store transient shopping cart contents and wishlist items so your selections persist while browsing.
3. Managing Your Storage: You can inspect, block, or delete cookies and site storage at any time through your web browser settings. Blocking the essential 'sid' cookie will prevent login and account access, but public storefront browsing remains available.`,
      ],
      [
        'Why we process your information',
        `We use your data for lawful, specific operational purposes:
- Authenticating your account and maintaining secure sessions.
- Calculating order totals, verifying captured payments, and issuing numbered PDF invoices.
- Delivering purchased files and time-limited download tokens to your email and account vault.
- Redressing customer complaints, handling refunds, and responding to support tickets.
- Preventing payment fraud, unauthorized access, and abuse of digital download links.
- Complying with statutory accounting, tax, and consumer protection regulations.
- Sending optional newsletter updates only when you affirmatively opt in.`,
      ],
      [
        'Account security and technical safeguards',
        `We employ multi-layered technical and organizational measures to safeguard your personal data:
- Password Security: Passwords are protected using salted bcrypt cryptographic hashing; plaintext passwords are never stored or logged.
- Transport Encryption: All data transferred between your browser and our server is encrypted using TLS / HTTPS.
- Access Restrictions: Customer order records and download tokens are stored in an authenticated database with strict server-side authorization checks enforcing user ownership.
- Staff Discretion: Support personnel never request passwords, OTPs, CVVs, or financial credentials.`,
      ],
      [
        'Service providers and disclosures',
        `We share necessary data with trusted service providers strictly to perform operational functions:
- Payment Gateways: Authorized processors (Easebuzz, PayU, Paddle) to process payments, verify transactions, and coordinate refunds.
- Cloud Hosting & Database: Enterprise cloud infrastructure providers to host the application and store encrypted records.
- Transactional Email: Reputable email infrastructure (such as Resend) to deliver purchase confirmations, download links, and invoices.
We may disclose information where required by court order, law enforcement, or applicable legal process. We do not share customer information with advertising networks.`,
      ],
      [
        'Data retention and account deletion',
        `We retain account and profile information for as long as your account remains active. Transaction, payment, invoice, and dispute records are retained for the statutory period required under applicable Indian commercial, tax, and consumer protection laws.
You may request deletion of your account by emailing ${BUSINESS.email}. Deletion of an account does not erase historical billing and invoice records required by law or necessary to defend legal claims.`,
      ],
      [
        'Your privacy rights',
        `You have the right to:
- Access and review the personal information we hold about you.
- Request correction of inaccurate or incomplete profile information.
- Request deletion of your account and personal data, subject to legal retention obligations.
- Opt out of promotional newsletter emails at any time via support or the provided link.
To exercise your rights, email ${BUSINESS.email}. We will verify your identity before disclosing or modifying records.`,
      ],
      [
        'Children’s privacy and policy updates',
        `Our storefront is not directed at children under the age of 18. We do not knowingly collect personal data from minors without parental consent.
We may update this Privacy Policy from time to time to reflect operational, legal, or technical changes. Material updates will be published with a revised date on this page. Continued use of the storefront after updates constitutes acknowledgment of the revised policy.`,
      ],
    ]
  ),

  refund: createPolicy(
    'refund',
    'Refund & Return Policy',
    [
      'Clear, fair refund standards for digital source code packages and website templates.',
      'Eligible grounds: duplicate debits, verified non-delivery, wrong files, and unresolved material defects.',
      'Approved refunds are initiated within 5–7 working days to the original payment method.',
    ],
    [
      [
        'Scope and nature of digital goods',
        `This policy applies to all digital website templates and software packages purchased directly through ${BUSINESS.name} at ${BUSINESS.url}.
Because our products are delivered electronically in downloadable source code formats (such as ZIP archives containing HTML, CSS, JavaScript, and React files), they cannot be physically returned once access has been granted. We review every refund claim individually against our transaction logs, delivery records, and the facts presented.`,
      ],
      [
        'Eligible grounds for a refund',
        `You may request a refund under the following circumstances:
1. Duplicate Payment: A verified duplicate successful charge for the same order reference.
2. Non-Delivery: Your payment was verified and captured, but digital access or download links were not delivered within 24 hours and support could not restore access.
3. Wrong Product or Missing Files: The delivered package contains files materially different from the purchased listing, or advertised core components are missing and cannot be supplied.
4. Unresolved Material Defect: A material technical defect prevents the product from performing its core documented function, and our support team cannot provide a fix or replacement within a reasonable timeframe.
5. Inability to Supply: An order cancelled by the store because we are unable to fulfill it.`,
      ],
      [
        'Circumstances generally ineligible for refund',
        `Refunds are generally not granted for:
- Change of mind or buyer's remorse after digital download files or access tokens have been delivered.
- Purchasing the wrong item by mistake when the listing accurately described the product.
- Inability to edit, customize, or deploy the code due to a lack of basic technical knowledge or required prerequisites disclosed in the product overview.
- Feature expectations that were not advertised in the product listing or official documentation.
- Defects or errors caused solely by your custom modifications, third-party plugin incompatibilities, or deployment environments that contradict documented technical requirements.`,
      ],
      [
        'How to submit a refund request',
        `To request a refund, email ${BUSINESS.email} from the email address associated with your order. Include:
1. Order Number (e.g., BS-YYYYMMDD-XXXXX) and registered customer email.
2. Payment Transaction Reference and date/amount paid.
3. Detailed description of the issue encountered.
4. For technical defects: clear error messages, screenshots, software environment details (Node/React/browser version), and steps to reproduce.
Never disclose passwords, OTPs, CVVs, or UPI PINs in your refund request.`,
      ],
      [
        'Review process, remedies and timeline',
        `We investigate refund claims by reviewing order logs, payment gateway capture records, delivery timestamps, and technical error submissions. Where feasible, we may first offer a corrected file, updated package, or configuration guidance.
If an eligible refund is approved, we will confirm the refund in writing and initiate it within 5–7 working days to the original payment method. Working days exclude weekends and bank holidays. Following initiation, processing times depend on your card issuer or bank (typically an additional 3–7 business days).`,
      ],
      [
        'Partial order refunds and discounts',
        `For multi-item orders where only one product is affected, a partial refund covering the price paid for that specific item (with any multi-item promotional discount allocated proportionately) will be issued. The license and access to unaffected products remain fully valid.`,
      ],
      [
        'License status following a refund',
        `When a refund is issued for a product, all download access to that product is immediately revoked, and the associated Product License is terminated. You must permanently delete all copies of the downloaded files and cease using them in any client or personal project. A refund issued solely for an accidental duplicate charge does not invalidate the original paid license.`,
      ],
      [
        'Open bank disputes and chargebacks',
        `If you have initiated a bank chargeback or dispute, please inform us so we can coordinate records with your payment provider. We do not require you to withdraw a legitimate bank dispute to receive support. However, to avoid duplicate reimbursement, we cannot issue a direct store refund while a formal bank chargeback is actively pending resolution with your financial institution.`,
      ],
      [
        'Statutory consumer rights',
        `Nothing in this policy limits, excludes, or restricts any statutory rights or consumer guarantees provided under Indian consumer protection laws. Mandatory consumer remedies supersede any conflicting provision in this store policy.`,
      ],
    ]
  ),

  cancellation: createPolicy(
    'cancellation',
    'Cancellation Policy',
    [
      'Straightforward rules for cancelling orders before electronic delivery takes place.',
      'Unpaid orders cancel automatically without debit.',
      'Approved cancellations are refunded to the original payment method within 5–7 working days.',
    ],
    [
      [
        'Scope of cancellation policy',
        `This policy applies to one-time purchases of digital templates and source code packages from ${BUSINESS.name}. It explains how orders can be cancelled prior to fulfillment. Once digital files or download tokens have been delivered, requests are evaluated under the Refund & Return Policy.`,
      ],
      [
        'Cancelling before payment authorization',
        `You may cancel your purchase at any time prior to authorizing payment by removing items from your cart or closing the checkout window. An unpaid order does not debit your account and does not grant download access. Abandoned checkout orders expire automatically without penalty.`,
      ],
      [
        'Cancelling after payment but before delivery',
        `Because our automated system generates digital download tokens and delivers confirmation emails shortly after payment capture (usually within 5 minutes), you must contact us immediately at ${BUSINESS.email} if you wish to cancel an order after payment.
Include your Order ID, registered email, and payment reference. If your cancellation request is received and verified before electronic download access is generated, we will cancel the order, prevent delivery, and initiate a full refund.`,
      ],
      [
        'Cancelling after digital delivery has commenced',
        `Once download links have been issued or digital files have been accessed via your My Account portal, the purchase cannot be cancelled as a change of mind, because the digital assets have been delivered. If the delivered files are defective, wrong, or undelivered, your request will be evaluated under the remedies provided in our Refund & Return Policy.`,
      ],
      [
        'Pending payments and authorization holds',
        `If checkout was interrupted but you observe a pending charge on your bank statement, please check with your financial institution. Temporary authorization holds for abandoned checkouts are released automatically by your bank according to their schedule. If a payment is captured on an abandoned order, email us immediately so we can confirm status and process a prompt refund.`,
      ],
      [
        'Store-initiated cancellations',
        `We reserve the right to cancel an order if:
1. The purchased product is unavailable or discontinued.
2. A material listing or pricing error occurred on the storefront.
3. The payment fails security verification or is suspected of unauthorized use.
If we cancel an order, we will notify you in writing and promptly refund 100% of the captured payment to the original payment method. No cancellation fees apply.`,
      ],
      [
        'Refund timeline for cancelled orders',
        `Refunds for eligible cancelled orders are initiated within 5–7 working days to the original payment source. Depending on your bank or card network, the credit will reflect in your account within customary banking timeframes. All statutory consumer rights under Indian law remain fully preserved.`,
      ],
    ]
  ),

  delivery: createPolicy(
    'delivery',
    'Digital Delivery Policy',
    [
      '100% electronic delivery by email and account download vault; zero shipping fees.',
      'Access typically ready within 5 minutes of verified payment capture.',
      'Clear guidelines on download tokens, link expiration, extraction, and offline backups.',
    ],
    [
      [
        'Digital products and delivery region',
        `We sell exclusively downloadable website templates, React codebases, and digital assets. No physical goods, parcel shipments, or postal packages are ever dispatched. No shipping, courier, handling, or cash-on-delivery fees apply to any order.
Our storefront checkout supports customers in India and processes transactions in Indian Rupees (INR).`,
      ],
      [
        'Delivery methods and fulfillment timing',
        `Following successful payment verification, your order is fulfilled through two synchronized electronic channels:
1. Transactional Email: We send a purchase confirmation email containing secure, single-use download links to your registered account email.
2. Account Download Vault: All purchased digital products immediately appear under the My Downloads tab in your authenticated customer portal at ${BUSINESS.url}/account/downloads.
Delivery is typically completed within 5 minutes of payment capture. In rare cases involving payment gateway verification holds, fraud prevention checks, or technical delays, delivery may take up to 24 hours. If you have not received access after 24 hours, contact us at ${BUSINESS.email}.`,
      ],
      [
        'When the delivery period begins',
        `Delivery processing begins only when our backend receives confirmed payment verification from the payment provider (Easebuzz, PayU, or Paddle). A pending bank authorization hold, browser redirect, or debit alert alone does not constitute payment confirmation. If your bank was debited but the order remains pending, contact support with your gateway transaction ID so we can verify the status with the gateway.`,
      ],
      [
        'Accessing and extracting your purchased files',
        `Your files are delivered in standard, compressed ZIP archives containing complete project source code, assets, and documentation.
To access your files:
1. Use the link in your confirmation email or sign in to ${BUSINESS.url}/account/downloads.
2. Download the ZIP archive to your local computer.
3. Extract the ZIP using standard built-in operating system tools (such as Windows Explorer, macOS Archive Utility, or Linux unzip).
4. Review the included README.md file for setup, installation, and customization instructions.`,
      ],
      [
        'Download links, security tokens and usage limits',
        `To protect digital assets from unauthorized public distribution, download links operate under strict security parameters:
- Browser streaming download tokens expire after 15 minutes of generation.
- Email download links expire after 168 hours (7 days) from issuance.
- Each purchased product includes an allocation of up to 10 download attempts.
Do not share download links publicly or use automated scrapers. If your valid download link expires or an interrupted connection consumes your attempts, contact support at ${BUSINESS.email} with your Order ID for verification and link reissue.`,
      ],
      [
        'Customer backup responsibility',
        `Because we sell downloadable code packages, you are responsible for downloading your files upon purchase and maintaining a secure, private offline backup. While purchased files remain accessible through your customer portal under normal store operation, our license does not constitute an indefinite cloud storage or archival hosting service.`,
      ],
      [
        'Troubleshooting missing or incomplete delivery',
        `If you have not received your files:
1. Check your email inbox, promotions, and spam/junk folders for messages from ${BUSINESS.name}.
2. Verify that you are signed in with the exact email address used at checkout.
3. Check ${BUSINESS.url}/account/downloads for active files.
If files are still missing, corrupted, or incomplete after checking these steps, contact us at ${BUSINESS.email} with your Order ID. We will promptly trace your order and reissue verified download links.`,
      ],
      [
        'What delivery includes and excludes',
        `Delivery includes the complete source code, component files, stylesheets, images, and documentation described in the product listing at the time of purchase.
Delivery does NOT include: web hosting, domain registration, SSL certificates, ongoing technical maintenance, third-party API credentials, or custom design and development services.`,
      ],
      [
        'Service interruptions and consumer remedies',
        `In the event of temporary infrastructure maintenance or network outages that interrupt digital delivery, our support team will manually verify and fulfill affected orders as soon as service is restored. If a verified paid digital product cannot be delivered, you are entitled to a full refund under our Refund & Return Policy.`,
      ],
    ]
  ),

  chargebacks: createPolicy(
    'chargebacks',
    'Chargeback & Dispute Policy',
    [
      'Constructive resolution process for payment disputes, billing questions, and bank chargebacks.',
      'Customers are encouraged to contact store support first for rapid resolution.',
      'Unrestricted right to contact your card issuer or bank; fair coordination to prevent duplicate reimbursement.',
    ],
    [
      [
        'What payment disputes and chargebacks mean',
        `A payment dispute is a formal inquiry regarding a transaction. A chargeback is a reversal mechanism provided by card-issuing banks and payment networks (such as Visa, Mastercard, RuPay, or UPI) allowing cardholders to dispute transactions for reasons such as unauthorized charges, non-delivery, or unresolved billing errors.
We respect your right to dispute charges through your financial institution. This policy outlines how disputes are handled fairly and transparently.`,
      ],
      [
        'Contacting support first for fast resolution',
        `If you notice an unrecognized charge, duplicate debit, incorrect amount, or have not received your files, we strongly recommend emailing ${BUSINESS.email} before initiating a bank chargeback.
Bank dispute investigations frequently take 30 to 90 days to conclude. Our customer support team can investigate transaction records, verify gateway status, restore missing download links, or process an approved refund directly within 5–7 working days, resolving your concern much faster.`,
      ],
      [
        'Valid grounds to raise a payment concern',
        `You should contact us promptly regarding:
- An unrecognized debit on your statement showing our merchant billing description.
- A duplicate captured debit for a single order.
- A verified debit where order confirmation or digital delivery failed to arrive.
- An approved refund that has not reflected in your account past communicated timeframes.
When contacting us, provide your Order ID, registered email, date, amount paid, and payment reference. Never send full card numbers, CVVs, OTPs, or banking passwords.`,
      ],
      [
        'Your right to contact your bank',
        `You maintain the legal right to contact your bank or card issuer at any time, especially if you suspect card fraud or account compromise. Contacting our support team is encouraged but is not mandatory. We never penalize, threaten, or charge fees to customers who exercise legitimate dispute rights through their financial institutions.`,
      ],
      [
        'Evidence submitted during formal dispute proceedings',
        `When a bank chargeback is initiated, the payment processor requires us to provide objective evidence regarding the transaction. We submit factual documentation, including:
- Server transaction timestamps and gateway authorization codes.
- Product descriptions and published terms accepted at checkout.
- Delivery records, including confirmation email dispatch logs and IP-stamped download token access logs.
- Support correspondence relevant to the dispute.
We provide accurate records and abide by the final determination rendered by the payment network or issuing bank.`,
      ],
      [
        'Digital access during an active dispute',
        `While a formal chargeback investigation is actively pending with a bank, digital download access for the disputed order may be temporarily suspended to prevent unauthorized access while funds are frozen. If the dispute is resolved in your favor (funds returned) or a store refund is issued, access and the Product License terminate. If the dispute confirms the transaction was valid and authorized, download access is promptly restored.`,
      ],
      [
        'Preventing duplicate reimbursement',
        `To ensure accounting accuracy, we coordinate store refunds with active bank disputes. If a bank has already issued a provisional or permanent chargeback credit, we cannot issue a second direct refund for the same transaction, as this would result in duplicate reimbursement. We will provide any documentation required by your bank to finalize the dispute.`,
      ],
      [
        'Fair dispute handling and consumer protections',
        `We treat all customer inquiries with fairness and professionalism. Raising a genuine billing question or bank dispute will never result in retaliatory action or account termination. Deliberate fraud, false dispute affidavits, or unauthorized use of third-party cards may be referred to payment network risk divisions. Your statutory consumer rights under Indian law remain fully protected.`,
      ],
    ]
  ),

  grievance: createPolicy(
    'grievance',
    'Complaints & Grievance Support',
    [
      'Statutory grievance redressal mechanism under the Consumer Protection (E-Commerce) Rules, 2020.',
      'Dedicated Grievance Officer contact details for prompt customer assistance.',
      'Acknowledgement within 48 hours; full complaint resolution within 30 days.',
    ],
    [
      [
        'Grievance redressal scope',
        `In compliance with the Consumer Protection Act, 2019 and the Consumer Protection (E-Commerce) Rules, 2020, ${BUSINESS.name} maintains a dedicated grievance redressal mechanism for customers.
You may submit a complaint regarding order processing, payment verification, digital file delivery, refund requests, cancellation disputes, product licensing, privacy concerns, or inaccurate storefront representations.`,
      ],
      [
        'Designated Grievance Officer details',
        `Customers may direct formal grievances to our designated Grievance Officer:
- Name: Grievance Redressal Officer
- Entity: ${BUSINESS.name}
- Postal Address: ${BUSINESS.address}
- Email: ${BUSINESS.email}
- Phone: ${BUSINESS.phone}
- Support Hours: ${BUSINESS.supportHours}
Please mark the email subject line clearly as "Grievance / Formal Complaint".`,
      ],
      [
        'How to submit a grievance',
        `To ensure rapid investigation and resolution, please provide:
1. Customer full name, registered email address, and phone number.
2. Order Number (e.g., BS-YYYYMMDD-XXXXX) and transaction reference.
3. Detailed summary of the grievance, including dates, products involved, and prior support ticket numbers if applicable.
4. Specific redress or outcome requested.
5. Relevant supporting documentation (such as redacted error logs or payment receipts). Never include sensitive banking PINs, OTPs, or passwords.`,
      ],
      [
        'Acknowledgement and resolution timeframes',
        `We adhere strictly to statutory service timeframes:
- Acknowledgement: We will acknowledge receipt of your grievance within 48 hours and assign a unique tracking reference.
- Resolution: We will investigate the matter thoroughly and provide a reasoned written resolution within 30 days (one month) of receiving the complaint.
If technical complexity or third-party bank verification requires additional time, we will provide interim status updates explaining the delay.`,
      ],
      [
        'Escalation procedure',
        `If you are unsatisfied with the proposed resolution:
1. Internal Escalation: Reply to the grievance thread with "Escalation Requested", stating the specific grounds for reconsideration. Your file will be reviewed by senior management.
2. External Redressal: You retain the full legal right to escalate your grievance to the National Consumer Helpline (NCH), approach the competent District/State Consumer Disputes Redressal Commission, or seek appropriate legal remedies under applicable Indian law.`,
      ],
      [
        'Non-retaliation and confidentiality',
        `All grievances are handled with strict confidentiality. Customer information submitted during a grievance is used solely to investigate and resolve the complaint. Submitting a complaint will never compromise your account standing or lawful rights.`,
      ],
    ]
  ),

  license: createPolicy(
    'license',
    'Product License',
    [
      'Clear commercial and personal licensing terms for all digital templates and source code.',
      'Permits customization and deployment for one end-project per purchase.',
      'Strictly prohibits reselling, sublicensing, or redistributing the code as reusable templates.',
    ],
    [
      [
        'License grant and scope',
        `When you purchase a digital website template or source package from ${BUSINESS.name}, you are granted a non-exclusive, non-transferable, worldwide commercial and personal license to use, customize, and deploy the code for one (1) single end-project.
This license does not transfer underlying copyright or intellectual property ownership. ${BUSINESS.name} retains all intellectual property rights in the original template code, layout design, and branding assets.`,
      ],
      [
        'What you are permitted to do',
        `Under this license, you are authorized to:
1. Customize: Modify, edit, add, or delete code, text, visual styling, components, and pages to meet project requirements.
2. Personal Projects: Deploy the customized website on your own domain for personal or business use.
3. Client Projects: Build and customize a website for a client, and transfer the final compiled/customized build to that specific client for their single end-project.
4. Host & Publish: Host the resulting customized application on any hosting provider (such as Vercel, Netlify, Cloudflare, AWS, or private servers).`,
      ],
      [
        'What you are strictly prohibited from doing',
        `You may NOT:
1. Resell, redistribute, sublicense, lease, or share the source code, whether modified or unmodified, as a template, UI kit, theme, stock resource, or digital download.
2. Upload the template source files to public GitHub repositories, open-source directories, or file-sharing websites.
3. Use a single purchase to create multiple distinct client websites or commercial end-projects. Each independent project requires its own separate license purchase.
4. Extract, repackage, or distribute individual components, animations, or styling systems as standalone commercial libraries.
5. Claim original authorship or exclusive copyright over the template design or code.`,
      ],
      [
        'Intellectual property and copyright notices',
        `All original design systems, source code architecture, SVG artwork, and documentation created by ${BUSINESS.name} are protected under copyright law.
Bundled third-party open-source libraries (such as React, Tailwind CSS, Lucide icons, or Vite) remain governed by their respective permissive open-source licenses (such as MIT or Apache 2.0). You must preserve required open-source attribution notices contained within package headers and license files.`,
      ],
      [
        'Trademarks and branding restrictions',
        `The names "BOOYAH STUDIO", associated logos, and brand assets are trademarks of ${BUSINESS.name}. This license does not grant permission to use our brand name, logo, or trademarks in client marketing, or to imply that your customized project is endorsed or certified by ${BUSINESS.name}.`,
      ],
      [
        'License termination',
        `This license remains effective unless terminated. The license terminates automatically without notice if you materially breach its terms, or if the purchase price is refunded or charged back. Upon termination, you must cease using the code, take down any deployed instances derived from the template, and permanently delete all copies in your possession.`,
      ],
      [
        'Multi-project licenses and enterprise inquiries',
        `If you require a multi-project license, agency bundle, or developer distribution permissions beyond the single end-project scope, contact us at ${BUSINESS.email} to discuss tailored commercial licensing terms.`,
      ],
    ]
  ),
};
