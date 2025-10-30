import { db, storage } from "./firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  increment,
} from "firebase/firestore";

const OFFICE_ZIP = import.meta.env.VITE_OFFICE_ZIP || "00000";
const PREFIX = import.meta.env.VITE_INVOICE_PREFIX || "hop";

function formatInvoiceNumber(num: number) {
  const formatted = String(num).padStart(3, "0");
  return `${PREFIX}-${OFFICE_ZIP}-${formatted}`;
}

// 🕵️ Just peek next number (does NOT increment)
export const peekNextInvoiceNumber = async (): Promise<string> => {
  const counterRef = doc(db, "meta", "invoiceCounter");
  const snapshot = await getDoc(counterRef);

  // Create counter doc if missing
  if (!snapshot.exists()) {
    await setDoc(counterRef, { lastNumber: 0 });
    return formatInvoiceNumber(1);
  }

  const data = snapshot.data();
  const current = Number(data?.lastNumber ?? 0);
  const next = current + 1;
  return formatInvoiceNumber(next);
};

// ✅ Reserve and increment invoice number
export const reserveInvoiceNumber = async (): Promise<string> => {
  const counterRef = doc(db, "meta", "invoiceCounter");
  const snapshot = await getDoc(counterRef);

  let newNumber = 1;

  if (snapshot.exists()) {
    const data = snapshot.data();
    const current = Number(data?.lastNumber ?? 0);
    newNumber = current + 1;
    await updateDoc(counterRef, { lastNumber: newNumber });
  } else {
    await setDoc(counterRef, { lastNumber: 1 });
  }

  return formatInvoiceNumber(newNumber);
};

// 🗂 Upload PDF to Firebase Storage
export const uploadInvoicePDF = async (blob: Blob, invoiceNumber: string) => {
  const fileRef = ref(storage, `invoices/${invoiceNumber}.pdf`);
  await uploadBytes(fileRef, blob);
  return await getDownloadURL(fileRef);
};

// 💾 Save invoice details to Firestore
export const saveInvoiceToDB = async (invoiceData: any) => {
  const invoiceRef = doc(db, "invoices", invoiceData.invoiceNumber);
  await setDoc(invoiceRef, {
    ...invoiceData,
    createdAt: new Date().toISOString(),
  });
};
