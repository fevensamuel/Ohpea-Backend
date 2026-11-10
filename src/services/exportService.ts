/**
 * Export Service for Excel and PDF generation
 */

import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { Member, Payment } from '../types.js';

export class ExportService {
  public async exportMembersToExcel(members: Member[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'OHPEA System';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('OHPEA Members');
    sheet.columns = [
      { header: 'Member No', key: 'memberNo', width: 18 },
      { header: 'Full Name', key: 'fullName', width: 28 },
      { header: 'Phone', key: 'phone', width: 18 },
      { header: 'Email', key: 'email', width: 28 },
      { header: 'Gender', key: 'gender', width: 12 },
      { header: 'Occupation', key: 'occupationType', width: 15 },
      { header: 'Town / City', key: 'town', width: 18 },
      { header: 'Reg Status', key: 'registrationStatus', width: 15 },
      { header: 'Membership', key: 'membershipStatus', width: 15 },
      { header: 'Registered On', key: 'createdAt', width: 20 },
    ];

    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF166534' }, // Forest green
    };

    for (const m of members) {
      sheet.addRow({
        memberNo: m.memberNo,
        fullName: m.fullName,
        phone: m.phone,
        email: m.email,
        gender: m.gender,
        occupationType: m.occupationType,
        town: m.town || 'N/A',
        registrationStatus: m.registrationStatus,
        membershipStatus: m.membershipStatus,
        createdAt: new Date(m.createdAt).toLocaleDateString(),
      });
    }

    return (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
  }

  public async exportPaymentsToExcel(payments: (Payment & { memberName?: string; memberNo?: string })[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'OHPEA Finance';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Contributions');
    sheet.columns = [
      { header: 'Receipt No', key: 'receiptNo', width: 18 },
      { header: 'Member No', key: 'memberNo', width: 18 },
      { header: 'Member Name', key: 'memberName', width: 26 },
      { header: 'Amount (ETB)', key: 'amountEtb', width: 15 },
      { header: 'Period', key: 'period', width: 12 },
      { header: 'Start Date', key: 'periodStart', width: 14 },
      { header: 'End Date', key: 'periodEnd', width: 14 },
      { header: 'Method', key: 'method', width: 15 },
      { header: 'Bank', key: 'bank', width: 16 },
      { header: 'Reference', key: 'reference', width: 18 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Paid At', key: 'paidAt', width: 18 },
    ];

    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E3A8A' }, // Deep Blue
    };

    for (const p of payments) {
      sheet.addRow({
        receiptNo: p.receiptNo,
        memberNo: p.memberNo || 'N/A',
        memberName: p.memberName || 'N/A',
        amountEtb: Number(p.amountEtb),
        period: p.period,
        periodStart: p.periodStart,
        periodEnd: p.periodEnd,
        method: p.method,
        bank: p.bank || 'N/A',
        reference: p.reference || 'N/A',
        status: p.status,
        paidAt: new Date(p.paidAt).toLocaleDateString(),
      });
    }

    return (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
  }

  public async exportMembersToPdf(members: Member[]): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const buffers: Buffer[] = [];

      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      // Header
      doc.fontSize(16).text('Oromia Hospitality & Tourism Professionals Association (OHPEA)', { align: 'center' });
      doc.fontSize(12).text('Official Member Register', { align: 'center' });
      doc.moveDown();
      doc.fontSize(9).text(`Generated: ${new Date().toISOString()}`, { align: 'right' });
      doc.fontSize(9).text(`Total Members: ${members.length}`, { align: 'left' });
      doc.moveDown();

      // Table Header
      doc.fontSize(10).fillColor('#166534').text('Member No | Full Name | Phone | Occupation | Status');
      doc.fillColor('#000000');
      doc.text('--------------------------------------------------------------------------------------------------');
      doc.moveDown(0.5);

      for (const m of members.slice(0, 100)) {
        doc.fontSize(9).text(
          `${m.memberNo.padEnd(16)} | ${(m.fullName || '').slice(0, 24).padEnd(24)} | ${m.phone.padEnd(15)} | ${(m.occupationType || '').padEnd(12)} | ${m.membershipStatus}`
        );
      }

      if (members.length > 100) {
        doc.moveDown();
        doc.fontSize(9).fillColor('#666666').text(`... and ${members.length - 100} more members.`);
      }

      doc.end();
    });
  }

  public async generateReceiptPdf(
    payment: Payment & { memberName?: string; memberNo?: string; memberPhone?: string }
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A5', layout: 'landscape' });
      const buffers: Buffer[] = [];

      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      // Border frame
      doc.rect(20, 20, 555, 380).lineWidth(2).strokeColor('#166534').stroke();

      // Header
      doc.fontSize(14).fillColor('#166534').text('OROMIA HOSPITALITY & TOURISM PROFESSIONALS ASSOCIATION', 40, 40, { align: 'center' });
      doc.fontSize(10).fillColor('#444444').text('Waldaa Ogeeyyii Hojii Simannaa fi Daawwanna Turizimii Oromiyaa (OHPEA)', { align: 'center' });
      doc.fontSize(12).fillColor('#000000').text('OFFICIAL CONTRIBUTION RECEIPT', { align: 'center', underline: true });
      doc.moveDown();

      // Receipt details in 2 columns
      doc.fontSize(10);
      const topY = 120;
      doc.text(`Receipt No: ${payment.receiptNo}`, 50, topY);
      doc.text(`Date Paid: ${new Date(payment.paidAt).toLocaleDateString()}`, 350, topY);

      doc.text(`Member No: ${payment.memberNo || 'N/A'}`, 50, topY + 25);
      doc.text(`Period Covered: ${payment.period.toUpperCase()} (${payment.periodStart} to ${payment.periodEnd})`, 350, topY + 25);

      doc.text(`Member Name: ${payment.memberName || 'N/A'}`, 50, topY + 50);
      doc.text(`Payment Method: ${payment.method} ${payment.bank ? `(${payment.bank})` : ''}`, 350, topY + 50);

      doc.text(`Phone: ${payment.memberPhone || 'N/A'}`, 50, topY + 75);
      doc.text(`Reference No: ${payment.reference || 'N/A'}`, 350, topY + 75);

      // Amount banner
      doc.rect(50, 230, 495, 45).fillColor('#f0fdf4').fill().strokeColor('#166534').stroke();
      doc.fontSize(14).fillColor('#166534').text(`AMOUNT RECEIVED: ${Number(payment.amountEtb).toLocaleString()} ETB`, 60, 245, { align: 'center' });

      // Signatures
      doc.fontSize(9).fillColor('#444444');
      doc.text('Issued by OHPEA Finance Administration', 50, 310);
      doc.text('Authorized Signature & Seal: ___________________', 320, 310);
      doc.fontSize(8).text('This is an official computer-generated receipt from the OHPEA Management System.', 50, 350, { align: 'center' });

      doc.end();
    });
  }
}

export const exportService = new ExportService();
