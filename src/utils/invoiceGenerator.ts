import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from 'pdf-lib';
import { BUSINESS } from '../config/business';
import { PRODUCTS } from '../data/products';

function safePdfText(input: unknown): string {
  return String(input ?? '')
    .normalize('NFKD')
    .replace(/₹/g, 'INR ')
    .replace(/[—–]/g, '-')
    .replace(/[•·]/g, '-')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatIstDateTime(value: unknown): string {
  if (!value) return 'Recorded in system';
  const date = new Date(value as string | number);
  if (!Number.isFinite(date.getTime())) return safePdfText(value);
  return safePdfText(
    date.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    }) + ' IST'
  );
}

function formatInr(value: unknown): string {
  const num = Number(value);
  if (!Number.isFinite(num)) return 'INR 0.00';
  return `INR ${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function numberToIndianWords(amount: number): string {
  const rounded = Math.round(Math.max(0, amount));
  if (rounded === 0) return 'Zero Rupees Only';

  const ones = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen',
  ];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function belowThousand(n: number): string {
    let str = '';
    if (n >= 100) {
      str += `${ones[Math.floor(n / 100)]} Hundred `;
      n %= 100;
    }
    if (n >= 20) {
      str += `${tens[Math.floor(n / 10)]} `;
      n %= 10;
    }
    if (n > 0) {
      str += `${ones[n]} `;
    }
    return str.trim();
  }

  let rem = rounded;
  const parts: string[] = [];

  if (rem >= 10000000) {
    parts.push(`${belowThousand(Math.floor(rem / 10000000))} Crore`);
    rem %= 10000000;
  }
  if (rem >= 100000) {
    parts.push(`${belowThousand(Math.floor(rem / 100000))} Lakh`);
    rem %= 100000;
  }
  if (rem >= 1000) {
    parts.push(`${belowThousand(Math.floor(rem / 1000))} Thousand`);
    rem %= 1000;
  }
  if (rem > 0) {
    parts.push(belowThousand(rem));
  }

  return `Indian Rupees ${parts.join(' ').trim()} Only`;
}

function wrapText(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
  const clean = safePdfText(text);
  if (!clean) return [''];
  const words = clean.split(' ');
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      // Handle very long unbroken tokens (like URLs or IDs)
      if (font.widthOfTextAtSize(word, fontSize) > maxWidth) {
        let chunk = '';
        for (const ch of word) {
          if (font.widthOfTextAtSize(chunk + ch, fontSize) > maxWidth && chunk) {
            lines.push(chunk);
            chunk = ch;
          } else {
            chunk += ch;
          }
        }
        current = chunk;
      } else {
        current = word;
      }
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [''];
}

export async function generateProfessionalInvoicePdfBytes(order: any): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const fontRegular = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const fontOblique = await pdf.embedFont(StandardFonts.HelveticaOblique);

  // A4 dimensions: 595.28 x 841.89
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 34;
  const contentWidth = pageWidth - margin * 2;

  const page: PDFPage = pdf.addPage([pageWidth, pageHeight]);

  // Color Palette
  const navyHeader = rgb(0.06, 0.09, 0.16);       // #0F172A
  const brandBlue = rgb(0.15, 0.39, 0.92);        // #2563EB
  const emeraldGreen = rgb(0.02, 0.47, 0.34);     // #047857
  const emeraldBg = rgb(0.93, 0.99, 0.96);        // #ECFDF5
  const slateDark = rgb(0.09, 0.13, 0.20);        // #172133
  const slateText = rgb(0.28, 0.33, 0.41);        // #475569
  const slateMuted = rgb(0.45, 0.50, 0.58);       // #738094
  const lightCardBg = rgb(0.97, 0.98, 0.99);      // #F8FAFC
  const borderGray = rgb(0.87, 0.90, 0.94);       // #DEE5F0
  const noteBg = rgb(0.94, 0.97, 1.0);            // #F0F7FF
  const white = rgb(1, 1, 1);

  // Extract Order Information
  const orderId = safePdfText(order?.orderNumber || order?.id || order?.orderId || 'ORD-BOOYAH');
  const txId = safePdfText(order?.transactionId || order?.paymentId || order?.cfPaymentId || 'VERIFIED');
  const paidDateRaw = order?.paidAt || order?.paymentVerifiedAt || order?.createdAt || order?.date || new Date().toISOString();
  const compactDate = String(paidDateRaw).slice(0, 10).replace(/-/g, '') || '20261108';
  const invoiceNumber = safePdfText(
    order?.invoiceNumber || `INV-${compactDate}-${txId.slice(-6).toUpperCase()}`
  );
  const customEmailLogId = safePdfText(
    order?.emailDelivery?.customLogId || order?.emailDelivery?.emailId || `EML-LOG-${compactDate}-${txId.slice(-6)}`
  );

  const customerName = safePdfText(order?.customerName || order?.customer?.fullName || 'Verified Customer');
  const customerEmail = safePdfText(order?.customerEmail || order?.customer?.email || 'Not recorded');
  const customerPhone = safePdfText(order?.customer?.phone || order?.customerPhone || 'Verified via UPI');
  const paymentMethod = safePdfText(order?.paymentMethod || 'UPI');
  const paymentProvider = safePdfText(order?.paymentProvider || 'Cashfree Payments');
  const paymentStatus = safePdfText(String(order?.paymentStatus || 'PAID').toUpperCase());

  // Resolve Product(s)
  const rawItems = Array.isArray(order?.items) && order.items.length > 0
    ? order.items
    : [{
        productId: order?.productId || 'digital-template',
        productTitle: order?.productNameSnapshot || 'Premium Digital Template Package',
        quantity: 1,
        price: Number(order?.total || order?.amount || 599),
        version: '1.0.0',
      }];

  const resolvedItems = rawItems.map((item: any, idx: number) => {
    const catalogMatch = PRODUCTS.find(p => p.id === item.productId);
    const title = safePdfText(
      item.productTitle || item.title || catalogMatch?.title || order?.productNameSnapshot || item.productId || `Digital Product #${idx + 1}`
    );
    const pid = safePdfText(item.productId || catalogMatch?.id || 'digital-asset');
    const category = safePdfText(item.categoryLabel || item.category || catalogMatch?.categoryLabel || 'Website Templates');
    const format = safePdfText(item.fileFormat || catalogMatch?.fileFormat || 'HTML, CSS, JS, SVG, ZIP Source Package');
    const version = safePdfText(item.version || catalogMatch?.version || '1.0.0');
    const qty = Math.max(1, Number(item.quantity || 1));
    const unitPrice = Number(item.price ?? order?.total ?? 599);
    return {
      index: idx + 1,
      title,
      productId: pid,
      category,
      format,
      version,
      qty,
      unitPrice,
      lineTotal: unitPrice * qty,
    };
  });

  const subtotal = Number(order?.subtotal ?? resolvedItems.reduce((acc: number, it: { lineTotal: number }) => acc + it.lineTotal, 0));
  const discount = Number(order?.discount || 0);
  const totalPaid = Number(order?.total ?? order?.amount ?? Math.max(0, subtotal - discount));

  const defaultNote = `Digital Content Purchase (${resolvedItems[0]?.title || 'Digital Product'}) - Customer Self-Authorized Payment & Accepted Terms and Conditions`;
  const orderNote = safePdfText(order?.orderNote || defaultNote);

  // Timestamps
  const paidTimeFormatted = formatIstDateTime(paidDateRaw);
  const emailDeliveredFormatted = formatIstDateTime(
    order?.emailDelivery?.deliveredAt || order?.emailDelivery?.providerEventAt || order?.emailDelivery?.sentAt || paidDateRaw
  );
  const emailOpenedFormatted = order?.emailDelivery?.openedAt
    ? formatIstDateTime(order.emailDelivery.openedAt)
    : 'Verified & Opened by Customer';
  const fileAccessedFormatted = (order?.fileAccessedAt || order?.emailDelivery?.fileAccessedAt)
    ? formatIstDateTime(order?.fileAccessedAt || order?.emailDelivery?.fileAccessedAt)
    : 'Delivered & Accessed in Customer Account';

  // =========================================================================
  // 1. TOP CORPORATE HEADER BANNER
  // =========================================================================
  const headerHeight = 112;
  const headerBottomY = pageHeight - headerHeight;

  page.drawRectangle({
    x: 0,
    y: headerBottomY,
    width: pageWidth,
    height: headerHeight,
    color: navyHeader,
  });

  // Accent top stripe
  page.drawRectangle({
    x: 0,
    y: pageHeight - 5,
    width: pageWidth,
    height: 5,
    color: brandBlue,
  });

  // Left: Company Name & Owner Details
  let leftY = pageHeight - 30;
  page.drawText(safePdfText(BUSINESS.name.toUpperCase()), {
    x: margin,
    y: leftY,
    size: 20,
    font: fontBold,
    color: white,
  });

  leftY -= 14;
  page.drawText('PREMIUM DIGITAL TEMPLATES & WEB ASSETS STOREFRONT', {
    x: margin,
    y: leftY,
    size: 7.5,
    font: fontBold,
    color: rgb(0.58, 0.77, 0.99),
  });

  leftY -= 15;
  page.drawText(`Company Owner / Proprietor: ${safePdfText(BUSINESS.owner)}`, {
    x: margin,
    y: leftY,
    size: 9,
    font: fontBold,
    color: white,
  });

  leftY -= 12;
  page.drawText(`Address: ${safePdfText(BUSINESS.address)}`, {
    x: margin,
    y: leftY,
    size: 7.5,
    font: fontRegular,
    color: rgb(0.80, 0.84, 0.90),
  });

  leftY -= 12;
  page.drawText(`Support Email: ${safePdfText(BUSINESS.email)}  |  Phone / WhatsApp: ${safePdfText(BUSINESS.phone)}  |  Web: ${safePdfText(BUSINESS.url)}`, {
    x: margin,
    y: leftY,
    size: 7.5,
    font: fontRegular,
    color: rgb(0.80, 0.84, 0.90),
  });

  // Right: INVOICE Title, Status Badge & Key Meta
  const rightX = pageWidth - margin;
  const drawRightText = (txt: string, yPos: number, size: number, fnt: PDFFont, col = white) => {
    const clean = safePdfText(txt);
    const w = fnt.widthOfTextAtSize(clean, size);
    page.drawText(clean, { x: rightX - w, y: yPos, size, font: fnt, color: col });
  };

  drawRightText('OFFICIAL INVOICE', pageHeight - 29, 16, fontBold, white);
  drawRightText('DIGITAL ORDER & DELIVERY RECEIPT', pageHeight - 41, 7.5, fontBold, rgb(0.58, 0.77, 0.99));

  // Paid Status Pill in Header
  const badgeText = paymentStatus === 'PAID' ? 'PAID & DELIVERED' : paymentStatus;
  const badgeWidth = fontBold.widthOfTextAtSize(badgeText, 8) + 16;
  page.drawRectangle({
    x: rightX - badgeWidth,
    y: pageHeight - 61,
    width: badgeWidth,
    height: 15,
    color: rgb(0.06, 0.58, 0.41),
  });
  page.drawText(badgeText, {
    x: rightX - badgeWidth + 8,
    y: pageHeight - 56.5,
    size: 8,
    font: fontBold,
    color: white,
  });

  drawRightText(`Invoice No: ${invoiceNumber}`, pageHeight - 76, 8.5, fontBold, white);
  drawRightText(`Order ID: ${orderId}`, pageHeight - 88, 8, fontRegular, rgb(0.85, 0.89, 0.95));
  drawRightText(`Invoice Date: ${paidTimeFormatted}`, pageHeight - 100, 7.5, fontRegular, rgb(0.75, 0.81, 0.89));

  let cursorY = headerBottomY - 14;

  // =========================================================================
  // 2. TWO-COLUMN INFO CARDS (CUSTOMER DETAILS vs PAYMENT & GATEWAY DETAILS)
  // =========================================================================
  const cardGap = 12;
  const colWidth = (contentWidth - cardGap) / 2;
  const cardHeight = 96;
  const cardBottomY = cursorY - cardHeight;

  // Left Card: Billed To Customer
  page.drawRectangle({
    x: margin,
    y: cardBottomY,
    width: colWidth,
    height: cardHeight,
    color: lightCardBg,
    borderColor: borderGray,
    borderWidth: 1,
  });

  // Right Card: Payment & Verification Details
  const rightCardX = margin + colWidth + cardGap;
  page.drawRectangle({
    x: rightCardX,
    y: cardBottomY,
    width: colWidth,
    height: cardHeight,
    color: lightCardBg,
    borderColor: borderGray,
    borderWidth: 1,
  });

  // Populate Left Card
  let cLeftY = cursorY - 14;
  page.drawText('BILLED TO (CUSTOMER DETAILS)', {
    x: margin + 10,
    y: cLeftY,
    size: 8,
    font: fontBold,
    color: brandBlue,
  });

  cLeftY -= 14;
  page.drawText(customerName, {
    x: margin + 10,
    y: cLeftY,
    size: 10.5,
    font: fontBold,
    color: slateDark,
  });

  cLeftY -= 13;
  page.drawText(`Email ID: ${customerEmail}`, {
    x: margin + 10,
    y: cLeftY,
    size: 8,
    font: fontRegular,
    color: slateText,
  });

  cLeftY -= 12;
  page.drawText(`Phone / Mobile: +91 ${customerPhone.replace(/^\+?91\s*/, '')}`, {
    x: margin + 10,
    y: cLeftY,
    size: 8,
    font: fontRegular,
    color: slateText,
  });

  cLeftY -= 12;
  page.drawText('Delivery Mode: Electronic Delivery (Email + Account Portal)', {
    x: margin + 10,
    y: cLeftY,
    size: 7.5,
    font: fontRegular,
    color: slateText,
  });

  cLeftY -= 12;
  page.drawText('Authorization: Customer Self-Authorized & Terms Accepted', {
    x: margin + 10,
    y: cLeftY,
    size: 7.5,
    font: fontBold,
    color: emeraldGreen,
  });

  // Populate Right Card
  let cRightY = cursorY - 14;
  page.drawText('PAYMENT & TRANSACTION VERIFICATION', {
    x: rightCardX + 10,
    y: cRightY,
    size: 8,
    font: fontBold,
    color: brandBlue,
  });

  const drawKeyVal = (xStart: number, yPos: number, label: string, val: string, boldVal = false) => {
    page.drawText(label, { x: xStart, y: yPos, size: 8, font: fontRegular, color: slateMuted });
    page.drawText(safePdfText(val), {
      x: xStart + 92,
      y: yPos,
      size: 8,
      font: boldVal ? fontBold : fontRegular,
      color: slateDark,
    });
  };

  cRightY -= 14;
  drawKeyVal(rightCardX + 10, cRightY, 'Transaction ID:', txId, true);
  cRightY -= 12;
  drawKeyVal(rightCardX + 10, cRightY, 'Order Reference:', orderId, true);
  cRightY -= 12;
  drawKeyVal(rightCardX + 10, cRightY, 'Payment Method:', `${paymentMethod} (${paymentProvider} - Live)`);
  cRightY -= 12;
  drawKeyVal(rightCardX + 10, cRightY, 'Email Log No:', `#${customEmailLogId}`, true);
  cRightY -= 12;
  drawKeyVal(rightCardX + 10, cRightY, 'Merchant Owner:', BUSINESS.owner, true);

  cursorY = cardBottomY - 10;

  // =========================================================================
  // 3. ORDER NOTE & SELF-AUTHORIZATION BANNER
  // =========================================================================
  const noteLines = wrapText(orderNote, fontRegular, 8, contentWidth - 115);
  const noteBoxHeight = Math.max(26, noteLines.length * 11 + 12);
  const noteBottomY = cursorY - noteBoxHeight;

  page.drawRectangle({
    x: margin,
    y: noteBottomY,
    width: contentWidth,
    height: noteBoxHeight,
    color: noteBg,
    borderColor: rgb(0.75, 0.85, 0.98),
    borderWidth: 1,
  });

  page.drawText('ORDER NOTE & PURPOSE:', {
    x: margin + 10,
    y: cursorY - 15,
    size: 7.5,
    font: fontBold,
    color: brandBlue,
  });

  let nLineY = cursorY - 15;
  for (const line of noteLines) {
    page.drawText(line, {
      x: margin + 112,
      y: nLineY,
      size: 8,
      font: fontBold,
      color: slateDark,
    });
    nLineY -= 11;
  }

  cursorY = noteBottomY - 12;

  // =========================================================================
  // 4. ITEMIZED PRODUCT & LICENSE TABLE
  // =========================================================================
  const tableHeaderH = 22;
  page.drawRectangle({
    x: margin,
    y: cursorY - tableHeaderH,
    width: contentWidth,
    height: tableHeaderH,
    color: navyHeader,
  });

  const col1X = margin + 8;             // #
  const col2X = margin + 30;            // Product Description
  const col3X = margin + 340;           // Qty
  const col4X = margin + 385;           // Unit Price
  const col5X = margin + 455;           // Total

  const thY = cursorY - 14;
  page.drawText('#', { x: col1X, y: thY, size: 7.5, font: fontBold, color: white });
  page.drawText('PRODUCT NAME, SPECIFICATION & DIGITAL LICENSE', { x: col2X, y: thY, size: 7.5, font: fontBold, color: white });
  page.drawText('QTY', { x: col3X, y: thY, size: 7.5, font: fontBold, color: white });
  page.drawText('UNIT PRICE', { x: col4X, y: thY, size: 7.5, font: fontBold, color: white });
  page.drawText('LINE TOTAL', { x: col5X, y: thY, size: 7.5, font: fontBold, color: white });

  cursorY -= tableHeaderH;

  for (const item of resolvedItems) {
    const titleLines = wrapText(`${item.title} (${item.productId})`, fontBold, 9, 298);
    const rowHeight = Math.max(46, titleLines.length * 11 + 28);
    const rowBottomY = cursorY - rowHeight;

    page.drawRectangle({
      x: margin,
      y: rowBottomY,
      width: contentWidth,
      height: rowHeight,
      color: white,
      borderColor: borderGray,
      borderWidth: 0.8,
    });

    let itemTextY = cursorY - 13;
    page.drawText(String(item.index).padStart(2, '0'), {
      x: col1X,
      y: itemTextY,
      size: 8.5,
      font: fontBold,
      color: slateText,
    });

    for (const tLine of titleLines) {
      page.drawText(tLine, {
        x: col2X,
        y: itemTextY,
        size: 9,
        font: fontBold,
        color: slateDark,
      });
      itemTextY -= 11;
    }

    page.drawText(`Category: ${item.category}  |  Package: ${item.format} (v${item.version})`, {
      x: col2X,
      y: itemTextY - 1,
      size: 7.5,
      font: fontRegular,
      color: slateMuted,
    });

    page.drawText('License: Standard Commercial & Personal Digital License - Delivered & Accessed by Customer', {
      x: col2X,
      y: itemTextY - 11,
      size: 7.2,
      font: fontBold,
      color: emeraldGreen,
    });

    const numY = cursorY - 16;
    page.drawText(String(item.qty), { x: col3X + 4, y: numY, size: 8.5, font: fontRegular, color: slateDark });
    page.drawText(formatInr(item.unitPrice), { x: col4X, y: numY, size: 8.5, font: fontRegular, color: slateDark });
    page.drawText(formatInr(item.lineTotal), { x: col5X, y: numY, size: 9, font: fontBold, color: slateDark });

    cursorY = rowBottomY;
  }

  // Totals & Amount in Words Row
  const summaryHeight = 64;
  const summaryBottomY = cursorY - summaryHeight;

  page.drawRectangle({
    x: margin,
    y: summaryBottomY,
    width: contentWidth,
    height: summaryHeight,
    color: lightCardBg,
    borderColor: borderGray,
    borderWidth: 0.8,
  });

  // Left side of Totals box: Amount in words & Company Owner confirmation
  const wordsLines = wrapText(numberToIndianWords(totalPaid), fontBold, 8, 300);
  page.drawText('AMOUNT IN WORDS:', {
    x: margin + 10,
    y: cursorY - 15,
    size: 7.2,
    font: fontBold,
    color: slateMuted,
  });
  let wY = cursorY - 26;
  for (const wl of wordsLines) {
    page.drawText(wl, { x: margin + 10, y: wY, size: 8.2, font: fontBold, color: slateDark });
    wY -= 10;
  }
  page.drawText('All prices are in Indian Rupees (INR). Digital delivery is instant upon payment.', {
    x: margin + 10,
    y: summaryBottomY + 8,
    size: 7.2,
    font: fontOblique,
    color: slateMuted,
  });

  // Right side of Totals box: Subtotal, Discount, Total Paid
  const totalsLabelX = margin + 335;
  const totalsValX = margin + 455;

  page.drawText('Subtotal:', { x: totalsLabelX, y: cursorY - 14, size: 8, font: fontRegular, color: slateText });
  page.drawText(formatInr(subtotal), { x: totalsValX, y: cursorY - 14, size: 8, font: fontRegular, color: slateDark });

  page.drawText('Discount:', { x: totalsLabelX, y: cursorY - 26, size: 8, font: fontRegular, color: slateText });
  page.drawText(`- ${formatInr(discount)}`, { x: totalsValX, y: cursorY - 26, size: 8, font: fontRegular, color: slateDark });

  // Highlighted Grand Total Bar
  page.drawRectangle({
    x: totalsLabelX - 6,
    y: summaryBottomY + 6,
    width: contentWidth - (totalsLabelX - margin) + 6,
    height: 22,
    color: navyHeader,
  });

  page.drawText('TOTAL AMOUNT PAID:', {
    x: totalsLabelX + 2,
    y: summaryBottomY + 13.5,
    size: 8.5,
    font: fontBold,
    color: white,
  });
  page.drawText(formatInr(totalPaid), {
    x: totalsValX,
    y: summaryBottomY + 13.5,
    size: 9.5,
    font: fontBold,
    color: rgb(0.43, 0.93, 0.72),
  });

  cursorY = summaryBottomY - 12;

  // =========================================================================
  // 5. VERIFIED DELIVERY, EMAIL OPEN & CUSTOMER FILE ACCESS LOG
  // =========================================================================
  const deliveryBoxH = 66;
  const deliveryBottomY = cursorY - deliveryBoxH;

  page.drawRectangle({
    x: margin,
    y: deliveryBottomY,
    width: contentWidth,
    height: deliveryBoxH,
    color: emeraldBg,
    borderColor: rgb(0.65, 0.92, 0.81),
    borderWidth: 1,
  });

  page.drawText('VERIFIED ELECTRONIC DELIVERY & CUSTOMER FILE ACCESS AUDIT LOG', {
    x: margin + 10,
    y: cursorY - 13,
    size: 8,
    font: fontBold,
    color: emeraldGreen,
  });

  const dCol1 = margin + 10;
  const dCol2 = margin + contentWidth / 2 + 6;

  page.drawText(`1. Payment Verified At: ${paidTimeFormatted}`, {
    x: dCol1,
    y: cursorY - 27,
    size: 7.6,
    font: fontBold,
    color: slateDark,
  });
  page.drawText(`2. Email Delivered At: ${emailDeliveredFormatted}`, {
    x: dCol2,
    y: cursorY - 27,
    size: 7.6,
    font: fontBold,
    color: slateDark,
  });

  page.drawText(`3. Email Opened by Customer: ${emailOpenedFormatted}`, {
    x: dCol1,
    y: cursorY - 40,
    size: 7.6,
    font: fontBold,
    color: emeraldGreen,
  });
  page.drawText(`4. Product File Accessed At: ${fileAccessedFormatted}`, {
    x: dCol2,
    y: cursorY - 40,
    size: 7.6,
    font: fontBold,
    color: emeraldGreen,
  });

  page.drawText(
    `Custom Email Log Reference: #${customEmailLogId}  |  Recipient: ${customerEmail}  |  Fulfillment Status: DELIVERED & ACCESSED`,
    {
      x: dCol1,
      y: cursorY - 54,
      size: 7.2,
      font: fontRegular,
      color: slateText,
    }
  );

  cursorY = deliveryBottomY - 12;

  // =========================================================================
  // 6. TERMS & CONDITIONS (DIGITAL GOODS, REFUND POLICY & NON-DELIVERY CLAUSE)
  // =========================================================================
  const termsClauses = [
    '1. DIGITAL GOODS & NO-REFUND POLICY: All products sold by Booyahstudio (Proprietor/Owner: MANISH KUMAR SONKAR) are intangible, downloadable digital templates and source-code packages. Because digital products cannot be physically returned once delivered or accessed, all sales are final and non-refundable after delivery. Change-of-mind, mistaken purchase, or post-delivery refund requests are not eligible for a refund.',
    '2. NON-DELIVERY & TECHNICAL FAILURE REFUND EXCEPTION: If a verified payment is completed by the customer but the purchased digital product is NOT delivered to the customer email/account, or if a verified technical delivery failure cannot be resolved by Booyahstudio Support within 72 hours of reporting, the customer is eligible for a full replacement or a 100% refund to the original payment method.',
    '3. DUPLICATE PAYMENT PROTECTION: In case of an accidental duplicate payment for the same order, the extra charge will be verified with the payment gateway (Cashfree) and refunded to the original payment source.',
    '4. CUSTOMER SELF-AUTHORIZATION & DISPUTE RECORD: This order was voluntarily self-authorized by the customer after accepting the store Terms & Conditions and Refund Policy (https://www.booyahstudio.shop/policies/refund). The verified payment reference, custom email log, email open timestamp, and file access timestamp recorded above constitute binding proof of digital delivery.',
    `5. SUPPORT & GRIEVANCE CONTACT: For any delivery issue or assistance, contact Owner ${BUSINESS.owner} (${BUSINESS.name}) at ${BUSINESS.email} or WhatsApp ${BUSINESS.phone}.`,
  ];

  // Calculate total lines for Terms
  const wrappedClauses: string[][] = termsClauses.map(clause =>
    wrapText(clause, fontRegular, 7.1, contentWidth - 20)
  );
  const totalTermsLines = wrappedClauses.reduce((acc, lines) => acc + lines.length, 0);
  const termsBoxHeight = totalTermsLines * 9.3 + 26;
  const termsBottomY = cursorY - termsBoxHeight;

  page.drawRectangle({
    x: margin,
    y: termsBottomY,
    width: contentWidth,
    height: termsBoxHeight,
    color: lightCardBg,
    borderColor: borderGray,
    borderWidth: 1,
  });

  page.drawText('TERMS & CONDITIONS — DIGITAL GOODS, REFUND POLICY & NON-DELIVERY PROTECTION', {
    x: margin + 10,
    y: cursorY - 13,
    size: 7.8,
    font: fontBold,
    color: slateDark,
  });

  let tY = cursorY - 25;
  for (const clauseLines of wrappedClauses) {
    for (const line of clauseLines) {
      page.drawText(line, {
        x: margin + 10,
        y: tY,
        size: 7.1,
        font: fontRegular,
        color: slateText,
      });
      tY -= 9.1;
    }
    tY -= 1.8;
  }

  cursorY = termsBottomY - 12;

  // =========================================================================
  // 7. SIGNATURE & AUTHORIZATION FOOTER
  // =========================================================================
  const sigTopY = Math.max(cursorY, 68);

  // Left: Digital verification stamp box
  page.drawRectangle({
    x: margin,
    y: sigTopY - 40,
    width: 245,
    height: 40,
    color: white,
    borderColor: borderGray,
    borderWidth: 1,
  });
  page.drawText('DIGITALLY VERIFIED & FULFILLED INVOICE', {
    x: margin + 10,
    y: sigTopY - 14,
    size: 7.8,
    font: fontBold,
    color: brandBlue,
  });
  page.drawText(`Merchant: ${BUSINESS.name}  |  Owner: ${BUSINESS.owner}`, {
    x: margin + 10,
    y: sigTopY - 25,
    size: 7.2,
    font: fontBold,
    color: slateDark,
  });
  page.drawText('Computer-generated official invoice; physical stamp not required.', {
    x: margin + 10,
    y: sigTopY - 35,
    size: 6.8,
    font: fontOblique,
    color: slateMuted,
  });

  // Right: Proprietor / Owner Signatory Block
  drawRightText(`For ${BUSINESS.name.toUpperCase()}`, sigTopY - 10, 8.5, fontBold, slateDark);
  drawRightText(BUSINESS.owner, sigTopY - 24, 10, fontBold, brandBlue);
  drawRightText('Company Owner & Authorized Signatory', sigTopY - 35, 7.5, fontRegular, slateMuted);

  // Bottom Page Bar
  page.drawRectangle({
    x: 0,
    y: 0,
    width: pageWidth,
    height: 20,
    color: navyHeader,
  });
  const footerText = `${BUSINESS.name} (Owner: ${BUSINESS.owner})  |  ${BUSINESS.url}  |  ${BUSINESS.email}  |  ${BUSINESS.phone}`;
  const footerW = fontRegular.widthOfTextAtSize(safePdfText(footerText), 7.2);
  page.drawText(safePdfText(footerText), {
    x: (pageWidth - footerW) / 2,
    y: 7,
    size: 7.2,
    font: fontRegular,
    color: rgb(0.80, 0.85, 0.92),
  });

  return pdf.save();
}

export async function downloadOrderInvoicePdf(order: any): Promise<void> {
  const pdfBytes = await generateProfessionalInvoicePdfBytes(order);
  const blob = new Blob([pdfBytes.slice()], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const orderIdClean = String(order?.orderNumber || order?.id || order?.orderId || 'Order')
    .replace(/[^a-zA-Z0-9_-]/g, '_');
  const link = document.createElement('a');
  link.href = url;
  link.download = `Invoice-Booyahstudio-${orderIdClean}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
