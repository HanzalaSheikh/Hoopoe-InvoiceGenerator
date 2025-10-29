import { db } from "../firebase";
import { doc, getDoc, setDoc, updateDoc, increment, collection, addDoc, serverTimestamp } from "firebase/firestore";

const OFFICE_ZIP = "75300"; // your fixed ZIP

// 🔹 Generate next invoice number
export const getNextInvoiceNumber = async () => {
  const counterRef = doc(db, "invoiceCounters", OFFICE_ZIP);
  const docSnap = await getDoc(counterRef);

  let nextNumber = 1;
  if (docSnap.exists()) {
    nextNumber = docSnap.data().count + 1;
    await updateDoc(counterRef, { count: increment(1) });
  } else {
    await setDoc(counterRef, { count: 1 });
  }

  const formattedCount = String(nextNumber).padStart(3, "0");
  return `HOP-${OFFICE_ZIP}-${formattedCount}`;
};

// 🔹 Save invoice data in Firestore
export const saveInvoiceToDB = async (invoiceData: any) => {
  const invoicesRef = collection(db, "invoices");
  await addDoc(invoicesRef, {
    ...invoiceData,
    createdAt: serverTimestamp(),
  });
};
// 🔹 Additional Firestore related functions can be added here