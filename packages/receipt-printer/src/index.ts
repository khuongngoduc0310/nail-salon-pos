export type ReceiptLineItem = {
  serviceName: string;
  workerName: string;
  amountCents: number;
  tipCents: number;
};

export type ReceiptPaymentLine = {
  method: string;
  amountCents: number;
  tipCents: number;
  reference?: string | null;
};

export type ReceiptDocument = {
  salonName: string;
  salonAddress?: string;
  salonPhone?: string;
  receiptNumber: string;
  issuedAt: Date;
  customerName?: string | null;
  items: ReceiptLineItem[];
  subtotalCents: number;
  discountCents: number;
  tipCents: number;
  totalCents: number;
  paymentSummary: string;
  payments?: ReceiptPaymentLine[];
};

export type PrintResult = {
  success: boolean;
  provider: "mock" | "escpos" | "browser";
  message?: string;
};

export interface ReceiptPrinterAdapter {
  printReceipt(receipt: ReceiptDocument): Promise<PrintResult>;
  openCashDrawer?(): Promise<void>;
}

export class MockReceiptPrinterAdapter implements ReceiptPrinterAdapter {
  readonly printedReceipts: ReceiptDocument[] = [];

  async printReceipt(receipt: ReceiptDocument): Promise<PrintResult> {
    this.printedReceipts.push(receipt);
    return { success: true, provider: "mock", message: "Receipt captured by mock printer" };
  }

  async openCashDrawer(): Promise<void> {
    return undefined;
  }
}
