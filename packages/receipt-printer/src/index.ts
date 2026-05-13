export type ReceiptLineItem = {
  serviceName: string;
  workerName: string;
  amountCents: number;
  tipCents: number;
};

export type ReceiptDocument = {
  salonName: string;
  receiptNumber: string;
  issuedAt: Date;
  items: ReceiptLineItem[];
  subtotalCents: number;
  discountCents: number;
  tipCents: number;
  totalCents: number;
  paymentSummary: string;
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
