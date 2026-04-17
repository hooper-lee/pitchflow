/**
 * Seed script for demo data
 * Run with: npx tsx scripts/seed.ts
 */
import { db } from "../lib/db";
import { tenants, users, prospects, campaigns, emailTemplates } from "../lib/db/schema";
import bcrypt from "bcryptjs";

async function seed() {
  console.log("Seeding database...");

  // Create platform admin (no tenant, super_admin role)
  const adminHash = await bcrypt.hash("admin123456", 12);
  const [admin] = await db
    .insert(users)
    .values({
      email: "admin@aquaclaw.com",
      name: "Platform Admin",
      passwordHash: adminHash,
      role: "super_admin",
      tenantId: null,
    })
    .returning();

  console.log("Created admin:", admin.email, "(password: admin123456)");

  // Create demo tenant
  const [tenant] = await db
    .insert(tenants)
    .values({
      name: "Demo Company",
      plan: "pro",
    })
    .returning();

  console.log("Created tenant:", tenant.id);

  // Create demo user
  const passwordHash = await bcrypt.hash("demo123456", 12);
  const [user] = await db
    .insert(users)
    .values({
      email: "demo@aquaclaw.com",
      name: "Demo User",
      passwordHash,
      role: "team_admin",
      tenantId: tenant.id,
    })
    .returning();

  console.log("Created user:", user.email, "(password: demo123456)");

  // Create demo prospects
  const demoProspects = [
    {
      companyName: "TechCorp Inc",
      contactName: "John Smith",
      email: "john@techcorp.com",
      industry: "electronics",
      country: "USA",
      website: "https://techcorp.com",
      source: "manual",
      status: "new" as const,
    },
    {
      companyName: "AutoParts GmbH",
      contactName: "Hans Mueller",
      email: "hans@autoparts.de",
      industry: "auto",
      country: "Germany",
      website: "https://autoparts.de",
      source: "manual",
      status: "contacted" as const,
    },
    {
      companyName: "FashionTrade Ltd",
      contactName: "Sarah Johnson",
      email: "sarah@fashiontrade.co.uk",
      industry: "textile",
      country: "UK",
      website: "https://fashiontrade.co.uk",
      source: "hunter",
      status: "new" as const,
    },
  ];

  for (const p of demoProspects) {
    await db.insert(prospects).values({ ...p, tenantId: tenant.id });
  }

  console.log("Created", demoProspects.length, "demo prospects");

  // Create demo template
  const [template] = await db
    .insert(emailTemplates)
    .values({
      tenantId: tenant.id,
      name: "通用开发信模板",
      subject: "{{companyName}} 合作机会",
      body: `Hi {{contactName}},

I noticed that {{companyName}} is a leader in the {{industry}} space.

We specialize in providing high-quality products for the {{industry}} industry, and I believe there could be a great partnership opportunity between our companies.

Would you be open to a brief call to explore this further?

Best regards,
{{senderName}}`,
      angle: "value_prop",
      isDefault: true,
    })
    .returning();

  console.log("Created template:", template.name);

  console.log("\nSeed completed!");
  console.log("Admin login: admin@aquaclaw.com / admin123456");
  console.log("User login:  demo@aquaclaw.com / demo123456");
}

seed().catch(console.error);
