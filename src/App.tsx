import { useState } from "react";
import { Plus, Trash2, Download, RotateCcw } from "lucide-react";
import { doc, getDoc, setDoc, updateDoc, increment } from "firebase/firestore";
import { db } from "./firebase";
import jsPDF from "jspdf";

interface LineItem {
  id: string;
  description: string;
  quantity: number | string;
  rate: number | string;
}

interface ClientInfo {
  name: string;
  email: string;
  company: string;
  address: string;
}

interface InvoiceDetails {
  number: string;
  date: string;
  dueDate: string;
}

const PDF_CONFIG = {
  margin: 27,
  colors: {
    primary: [103, 101, 195], // Purple from logo
    accent: [13, 148, 136],
    darkGray: [17, 24, 39],
    mediumGray: [75, 85, 99],
    lightGray: [249, 250, 251],
    white: [255, 255, 255],
  },
  decorative: {
    triangleSize: 50,
    cornerRadius: 40,
  },
};

function App() {
  const logoUrl = "/logo.png";

  const currencies = [
    { code: "AED", name: "UAE Dirham", symbol: "AED" },
    { code: "AUD", name: "Australian Dollar", symbol: "A$" },
    { code: "USD", name: "US Dollar", symbol: "$" },
    { code: "PKR", name: "Pakistani Rupee", symbol: "₨" },
    { code: "EUR", name: "Euro", symbol: "€" },
  ];

  const [currency, setCurrency] = useState(currencies[0]); // default: AED

  const [clientInfo, setClientInfo] = useState<ClientInfo>({
    name: "",
    email: "",
    company: "",
    address: "",
  });

  const [invoiceDetails, setInvoiceDetails] = useState<InvoiceDetails>({
    number: "",
    date: new Date().toISOString().split("T")[0],
    dueDate: "",
  });

  const [taxRate, setTaxRate] = useState<number | string>(0);
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: "1", description: "", quantity: "1", rate: "0" },
  ]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const parseNumber = (val: number | string): number => {
    if (typeof val === "number") return val;
    const s = (val ?? "").toString().trim();
    if (s === "") return 0;
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : 0;
  };

  const addLineItem = () => {
    setLineItems([
      ...lineItems,
      {
        id: Date.now().toString(),
        description: "",
        quantity: 1,
        rate: 0,
      },
    ]);
  };

  const removeLineItem = (id: string) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter((item) => item.id !== id));
    }
  };

  const updateLineItem = (
    id: string,
    field: keyof LineItem,
    value: string | number
  ) => {
    setLineItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const calculateSubtotal = () => {
    return lineItems.reduce((sum, item) => {
      const q = parseNumber(item.quantity);
      const r = parseNumber(item.rate);
      return sum + q * r;
    }, 0);
  };

  const calculateTax = () => {
    return calculateSubtotal() * (parseNumber(taxRate) / 100);
  };

  const calculateTotal = () => {
    return calculateSubtotal() + calculateTax();
  };

  const validateForm = (): boolean => {
    const newErrors: string[] = [];
    if (!clientInfo.name.trim()) newErrors.push("Client name is required");
    if (!clientInfo.email.trim()) newErrors.push("Client email is required");
    if (!invoiceDetails.number.trim())
      newErrors.push("Invoice number is required");
    if (!invoiceDetails.date) newErrors.push("Invoice date is required");
    if (!invoiceDetails.dueDate) newErrors.push("Due date is required");
    if (lineItems.some((item) => !item.description.trim())) {
      newErrors.push("All line items must have descriptions");
    }
    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const drawDecorativeElements = (
    doc: jsPDF,
    pageWidth: number,
    pageHeight: number
  ) => {
    doc.setFillColor(...PDF_CONFIG.colors.primary);

    // Top left corner
    doc.triangle(
      0,
      0,
      0,
      PDF_CONFIG.decorative.cornerRadius,
      PDF_CONFIG.decorative.triangleSize,
      0,
      "F"
    );

    // Top right corner
    doc.triangle(
      pageWidth - PDF_CONFIG.decorative.triangleSize,
      0,
      pageWidth,
      0,
      pageWidth,
      PDF_CONFIG.decorative.cornerRadius,
      "F"
    );

    // Bottom right corner
    doc.triangle(
      pageWidth,
      pageHeight - PDF_CONFIG.decorative.cornerRadius * 2,
      pageWidth,
      pageHeight,
      pageWidth - PDF_CONFIG.decorative.triangleSize,
      pageHeight,
      "F"
    );
  };

  const generatePDF = async () => {
    if (!validateForm()) return;
    setIsGenerating(true);

    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      // Background
      doc.setFillColor(...PDF_CONFIG.colors.white);
      doc.rect(0, 0, pageWidth, pageHeight, "F");

      // Decorative elements
      drawDecorativeElements(doc, pageWidth, pageHeight);

      let yPos = 50;

      // Company Logo
      const logoWidth = 50; // adjust width
      const logoHeight = 30; // adjust height
      const logoX = PDF_CONFIG.margin; // left margin
      const logoY = 36; // top position

      const logoUrl = "logo.png";
      const logoImage = await fetch(logoUrl)
        .then((res) => res.blob())
        .then((blob) => {
          return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.readAsDataURL(blob);
          });
        });

      doc.addImage(logoImage, "PNG", logoX, logoY, logoWidth, logoHeight);

      // let yPos = logoY + logoHeight + 20; // start client info below logo

      // Client Info Section
      yPos += 20;
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...PDF_CONFIG.colors.mediumGray);
      doc.text("BILL TO", PDF_CONFIG.margin, yPos);

      yPos += 7;
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...PDF_CONFIG.colors.darkGray);
      doc.text(clientInfo.name, PDF_CONFIG.margin, yPos);

      yPos += 5;
      doc.text(clientInfo.email, PDF_CONFIG.margin, yPos);

      if (clientInfo.company) {
        yPos += 5;
        doc.text(clientInfo.company, PDF_CONFIG.margin, yPos);
      }

      if (clientInfo.address) {
        yPos += 5;
        const addressLines = doc.splitTextToSize(clientInfo.address, 80);
        doc.text(addressLines, PDF_CONFIG.margin, yPos);
        yPos += (addressLines.length - 1) * 5;
      }

      // Invoice Details (Right side)
      let rightY = 50;
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...PDF_CONFIG.colors.mediumGray);

      const labelX = pageWidth - PDF_CONFIG.margin - 50;
      const valueX = pageWidth - PDF_CONFIG.margin;

      doc.text("Invoice Number:", labelX, rightY);

      // Make the invoice number bold and dark
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...PDF_CONFIG.colors.darkGray);
      doc.text(invoiceDetails.number, valueX, rightY, { align: "right" });

      // Reset back to normal font for next fields
      doc.setFont("helvetica", "normal");

      rightY += 6;
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...PDF_CONFIG.colors.mediumGray);
      doc.text("Date:", labelX, rightY);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...PDF_CONFIG.colors.darkGray);
      doc.text(invoiceDetails.date, valueX, rightY, { align: "right" });

      rightY += 6;
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...PDF_CONFIG.colors.mediumGray);
      doc.text("Due Date:", labelX, rightY);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...PDF_CONFIG.colors.darkGray);
      doc.text(invoiceDetails.dueDate, valueX, rightY, { align: "right" });

      // Line Items Table
      let tableY = Math.max(yPos + 15, rightY + 15);

      // Table header
      doc.setFillColor(...PDF_CONFIG.colors.primary);
      doc.rect(
        PDF_CONFIG.margin,
        tableY,
        pageWidth - PDF_CONFIG.margin * 2,
        10,
        "F"
      );

      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...PDF_CONFIG.colors.white);
      // doc.text('DESCRIPTION', PDF_CONFIG.margin + 3, tableY + 6.5);
      // doc.text('QTY', pageWidth - PDF_CONFIG.margin - 65, tableY + 6.5);
      // doc.text('RATE', pageWidth - PDF_CONFIG.margin - 45, tableY + 6.5);
      // doc.text('AMOUNT', pageWidth - PDF_CONFIG.margin - 20, tableY + 6.5);

      const descX = PDF_CONFIG.margin + 3;
      const qtyX = pageWidth - PDF_CONFIG.margin - 70;
      const rateX = pageWidth - PDF_CONFIG.margin - 50;
      const amountX = pageWidth - PDF_CONFIG.margin - 3;

      // Table Header
      doc.text("DESCRIPTION", descX, tableY + 6.5);
      doc.text("QTY", qtyX, tableY + 6.5);
      doc.text("RATE", rateX, tableY + 6.5);
      doc.text("AMOUNT", amountX, tableY + 6.5, { align: "right" });

      // tableY += 10;
      tableY += 16;

      // Line items
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...PDF_CONFIG.colors.darkGray);

      // lineItems.forEach((item, index) => {
      //   const qty = parseNumber(item.quantity);
      //   const rate = parseNumber(item.rate);
      //   const amount = qty * rate;

      //   if (index % 2 === 0) {
      //     doc.setFillColor(...PDF_CONFIG.colors.lightGray);
      //     doc.rect(PDF_CONFIG.margin, tableY - 4, pageWidth - (PDF_CONFIG.margin * 2), 8, 'F');
      //   }

      //   const descLines = doc.splitTextToSize(item.description, pageWidth - (PDF_CONFIG.margin * 2) - 80);
      //   doc.text(descLines, PDF_CONFIG.margin + 2, tableY);
      //   doc.text(qty.toString(), pageWidth - PDF_CONFIG.margin - 70, tableY);
      //   doc.text(`$${rate.toFixed(2)}`, pageWidth - PDF_CONFIG.margin - 50, tableY);

      //   doc.setFont('helvetica', 'bold');
      //   doc.text(`$${amount.toFixed(2)}`, pageWidth - PDF_CONFIG.margin - 3, tableY, { align: 'right' });
      //   doc.setFont('helvetica', 'normal');

      //   tableY += Math.max(8, descLines.length * 5);
      // });

      // Summary

      // Define consistent X positions

      // Line Items
      lineItems.forEach((item, index) => {
        const qty = parseNumber(item.quantity);
        const rate = parseNumber(item.rate);
        const amount = qty * rate;

        if (index % 2 === 0) {
          doc.setFillColor(...PDF_CONFIG.colors.lightGray);
          doc.rect(
            PDF_CONFIG.margin,
            tableY - 4,
            pageWidth - PDF_CONFIG.margin * 2,
            8,
            "F"
          );
        }

        const descLines = doc.splitTextToSize(
          item.description,
          pageWidth - PDF_CONFIG.margin * 2 - 80
        );
        doc.text(descLines, descX, tableY);
        doc.text(qty.toString(), qtyX, tableY);
        doc.text(`${currency.symbol} ${rate.toFixed(2)}`, rateX, tableY);
        doc.setFont("helvetica", "bold");
        doc.text(`${currency.symbol} ${amount.toFixed(2)}`, amountX, tableY, {
          align: "right",
        });
        doc.setFont("helvetica", "normal");

        tableY += Math.max(8, descLines.length * 5);
      });

      doc.setDrawColor(229, 231, 235);
      doc.setLineWidth(0.1);
      doc.line(
        PDF_CONFIG.margin,
        tableY,
        pageWidth - PDF_CONFIG.margin,
        tableY
      );

      tableY += 10;
      const summaryX = pageWidth - PDF_CONFIG.margin - 60;

      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...PDF_CONFIG.colors.mediumGray);
      doc.text("Subtotal:", summaryX, tableY);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...PDF_CONFIG.colors.darkGray);
      doc.text(
        `${currency.symbol} ${calculateSubtotal().toFixed(2)}`,
        pageWidth - PDF_CONFIG.margin - 3,
        tableY,
        { align: "right" }
      );

      tableY += 6;
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...PDF_CONFIG.colors.mediumGray);
      doc.text(`Tax (${parseNumber(taxRate)}%):`, summaryX, tableY);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...PDF_CONFIG.colors.darkGray);
      doc.text(
        `${currency.symbol} ${calculateTax().toFixed(2)}`,
        pageWidth - PDF_CONFIG.margin - 3,
        tableY,
        { align: "right" }
      );

      tableY += 8;
      doc.setFillColor(...PDF_CONFIG.colors.accent);
      doc.rect(summaryX - 5, tableY - 6, 65, 10, "F");

      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...PDF_CONFIG.colors.white);
      doc.text("Total:", summaryX, tableY);
      doc.setFontSize(12);
      doc.text(
        `${currency.symbol} ${calculateTotal().toFixed(2)}`,
        pageWidth - PDF_CONFIG.margin - 3,
        tableY,
        { align: "right" }
      );

      // Signature line
      // tableY += 30;
      // doc.setFontSize(10);
      // doc.setFont('helvetica', 'bold');
      // doc.setTextColor(...PDF_CONFIG.colors.mediumGray);
      // doc.text('Authorized Signature:', PDF_CONFIG.margin, tableY);

      // tableY += 12;
      // doc.setDrawColor(200, 200, 200);
      // doc.setLineWidth(0.5);
      // doc.line(PDF_CONFIG.margin, tableY, PDF_CONFIG.margin + 60, tableY);

      // Signature line
      tableY += 30;
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...PDF_CONFIG.colors.mediumGray);
      doc.text("Authorized Signature:", PDF_CONFIG.margin, tableY);

      // Add the signature image
      try {
        const signatureUrl = "signature.png";
        const signatureBlob = await fetch(signatureUrl).then((res) =>
          res.blob()
        );
        const signatureBase64 = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.readAsDataURL(signatureBlob);
        });

        const signatureWidth = 30;
        const signatureHeight = 15;
        const signatureX = PDF_CONFIG.margin;
        const signatureY = tableY + 3; // a bit below the text

        doc.addImage(
          signatureBase64,
          "PNG",
          signatureX,
          signatureY,
          signatureWidth,
          signatureHeight
        );
      } catch (err) {
        console.error("Error adding signature:", err);
      }

      tableY += 40; // move below the signature
      doc.setDrawColor(200, 200, 200);
      // doc.setLineWidth(0.5);
      // doc.line(PDF_CONFIG.margin, tableY, PDF_CONFIG.margin + 60, tableY);

      // Footer
      doc.setFontSize(8);
      doc.setTextColor(...PDF_CONFIG.colors.mediumGray);
      doc.text("Hoopoe Studios", pageWidth / 2, pageHeight - 15, {
        align: "center",
      });

      doc.save(`invoice-${invoiceDetails.number}.pdf`);
    } catch (error) {
      console.error("PDF generation failed:", error);
      setErrors(["Failed to generate PDF. Please try again."]);
    } finally {
      setIsGenerating(false);
    }
  };

  const clearDraft = () => {
    setClientInfo({ name: "", email: "", company: "", address: "" });
    setInvoiceDetails({
      number: "",
      date: new Date().toISOString().split("T")[0],
      dueDate: "",
    });
    setLineItems([{ id: "1", description: "", quantity: 1, rate: 0 }]);
    setTaxRate(0);
    setErrors([]);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-purple-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6 border border-purple-100">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center justify-center">
              <span>
                <img
                  src="logo.png"
                  alt="Hoopoe Studios Logo"
                  className="w-40 h-25"
                />
              </span>
            </div>
            <span className="text-sm text-gray-500">Invoice Generator</span>
          </div>

          {errors.length > 0 && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <h3 className="text-sm font-semibold text-red-800 mb-2">
                Please fix the following errors:
              </h3>
              <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
                {errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-8 mb-8">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <div className="w-1 h-5 bg-purple-500 rounded"></div>
                Client Information
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Client Name *
                  </label>
                  <input
                    type="text"
                    value={clientInfo.name}
                    onChange={(e) =>
                      setClientInfo({ ...clientInfo, name: e.target.value })
                    }
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                    placeholder="John Doe"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email *
                  </label>
                  <input
                    type="email"
                    value={clientInfo.email}
                    onChange={(e) =>
                      setClientInfo({ ...clientInfo, email: e.target.value })
                    }
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                    placeholder="john@example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Company
                  </label>
                  <input
                    type="text"
                    value={clientInfo.company}
                    onChange={(e) =>
                      setClientInfo({ ...clientInfo, company: e.target.value })
                    }
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                    placeholder="Acme Corp"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Address
                  </label>
                  <textarea
                    value={clientInfo.address}
                    onChange={(e) =>
                      setClientInfo({ ...clientInfo, address: e.target.value })
                    }
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all resize-none"
                    rows={3}
                    placeholder="123 Main St, City, State, ZIP"
                  />
                </div>
              </div>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <div className="w-1 h-5 bg-purple-500 rounded"></div>
                Invoice Details
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Invoice Number *
                  </label>
                  <input
                    type="text"
                    value={invoiceDetails.number}
                    onChange={(e) =>
                      setInvoiceDetails({
                        ...invoiceDetails,
                        number: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                    placeholder="hop-001"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date *
                  </label>
                  <input
                    type="date"
                    value={invoiceDetails.date}
                    onChange={(e) =>
                      setInvoiceDetails({
                        ...invoiceDetails,
                        date: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Due Date *
                  </label>
                  <input
                    type="date"
                    value={invoiceDetails.dueDate}
                    onChange={(e) =>
                      setInvoiceDetails({
                        ...invoiceDetails,
                        dueDate: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tax Rate (%)
                  </label>
                  <input
                    type="number"
                    value={parseNumber(taxRate)}
                    onChange={(e) => setTaxRate(e.target.value)}
                    onBlur={(e) => {
                      const num =
                        e.target.value === "" ? 0 : parseFloat(e.target.value);
                      setTaxRate(Number.isFinite(num) ? num : 0);
                    }}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                    min="0"
                    step="0.01"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Currency
                  </label>
                  <select
                    value={currency.code}
                    onChange={(e) => {
                      const selected = currencies.find(
                        (c) => c.code === e.target.value
                      );
                      if (selected) setCurrency(selected);
                    }}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                  >
                    {currencies.map((cur) => (
                      <option key={cur.code} value={cur.code}>
                        {cur.name} ({cur.symbol})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <div className="w-1 h-5 bg-purple-500 rounded"></div>
                Line Items
              </h2>
              <button
                onClick={addLineItem}
                className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-all shadow-sm hover:shadow-md"
              >
                <Plus className="w-4 h-4" />
                Add Item
              </button>
            </div>

            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                      Description
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 w-24">
                      Quantity
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 w-32">
                      Rate
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700 w-32">
                      Amount
                    </th>
                    <th className="w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {lineItems.map((item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) =>
                            updateLineItem(
                              item.id,
                              "description",
                              e.target.value
                            )
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                          placeholder="Item description"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) =>
                            updateLineItem(item.id, "quantity", e.target.value)
                          }
                          onBlur={(e) => {
                            const num =
                              e.target.value === ""
                                ? 0
                                : parseFloat(e.target.value);
                            updateLineItem(
                              item.id,
                              "quantity",
                              Number.isFinite(num) ? num : 0
                            );
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                          min="0"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <input
                          type="number"
                          value={item.rate}
                          onChange={(e) =>
                            updateLineItem(item.id, "rate", e.target.value)
                          }
                          onBlur={(e) => {
                            const num =
                              e.target.value === ""
                                ? 0
                                : parseFloat(e.target.value);
                            updateLineItem(
                              item.id,
                              "rate",
                              Number.isFinite(num) ? num : 0
                            );
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                          min="0"
                          step="0.01"
                        />
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-gray-900">
                      {currency.symbol} {" "}
                        {(
                          parseNumber(item.quantity) * parseNumber(item.rate)
                        ).toFixed(2)}
                      </td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => removeLineItem(item.id)}
                          disabled={lineItems.length === 1}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-6 flex justify-end">
              <div className="w-72 space-y-3 bg-gray-50 p-4 rounded-lg">
                <div className="flex justify-between py-2">
                  <span className="text-gray-700 font-medium">Subtotal:</span>
                  <span className="text-gray-900 font-semibold">
                  {currency.symbol} {calculateSubtotal().toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-gray-700 font-medium">
                    Tax ({parseNumber(taxRate)}%):
                  </span>
                  <span className="text-gray-900 font-semibold">
                  {currency.symbol} {calculateTax().toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between py-3 bg-purple-500 text-white px-1 rounded-lg">
                  <span className="text-lg font-bold">Total:</span>
                  <span className="text-lg font-bold">
                  {currency.symbol} {calculateTotal().toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-end">
            <button
              onClick={clearDraft}
              className="flex items-center justify-center gap-2 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all font-medium"
            >
              <RotateCcw className="w-5 h-5" />
              Clear Draft
            </button>
            <button
              onClick={generatePDF}
              disabled={isGenerating}
              className="flex items-center justify-center gap-2 px-8 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-all font-semibold shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Download className="w-5 h-5" />
                  Generate Invoice
                </>
              )}
            </button>
          </div>
        </div>

        <div className="text-center text-sm text-gray-500">
          <p>Made with ❤️ by Muhammad Hanzala</p>
        </div>
      </div>
    </div>
  );
}

export default App;
