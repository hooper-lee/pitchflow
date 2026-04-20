import type { PageSignals, ExtractedContact } from "./types";

export function extractContacts(signals: PageSignals): ExtractedContact {
  // Deduplicate emails
  const emailSet = new Set(signals.emailsFound.map((e) => e.toLowerCase()));
  const emails = Array.from(emailSet).filter((e) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)
  );

  // Prefer contact emails
  const contactEmails = emails.filter((e) =>
    /^(info|contact|sales|marketing|hello|support|admin|office|inquiry|enquiry)@/.test(e)
  );
  const otherEmails = emails.filter((e) => !contactEmails.includes(e));
  const sortedEmails = [...contactEmails, ...otherEmails];

  // Deduplicate phones
  const phoneSet = new Set(
    signals.phonesFound.map((p) => p.replace(/[^\d+\-().\s]/g, "").trim()).filter(Boolean)
  );

  // Deduplicate addresses
  const addressSet = new Set(signals.addressesFound.map((a) => a.trim()).filter(Boolean));

  // Pick best company name
  let companyName: string | null = null;
  if (signals.companyNamesFound.length > 0) {
    // Prefer longer names (more specific)
    companyName = signals.companyNamesFound.sort((a, b) => b.length - a.length)[0];
  }

  return {
    emails: sortedEmails.slice(0, 5),
    phones: Array.from(phoneSet).slice(0, 3),
    addresses: Array.from(addressSet).slice(0, 2),
    companyName,
    socialLinks: signals.socialLinks,
  };
}
