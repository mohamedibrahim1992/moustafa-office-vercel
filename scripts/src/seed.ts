import {
  db,
  usersTable,
  customersTable,
  invoicesTable,
  expensesTable,
  reportsTable,
  commandsTable,
  declarationsTable,
} from "@workspace/db";

async function main() {
  // Wipe all data so we can reseed cleanly
  await db.delete(declarationsTable);
  await db.delete(commandsTable);
  await db.delete(reportsTable);
  await db.delete(expensesTable);
  await db.delete(invoicesTable);
  await db.delete(customersTable);
  await db.delete(usersTable);

  const users = await db
    .insert(usersTable)
    .values([
      { name: "أ/مصطفى حمزة", password: "Mh!9kQp2vXz#L7", role: "admin", color: "#e74c3c" },
      { name: "أ/محمد رواج", password: "Rw@3nT8eYj$D5q", role: "manager", color: "#8b5cf6" },
      { name: "أ/يمنى", password: "Ym&4hF6cNa*B2x", role: "invoices", color: "#10b981" },
      { name: "أ/منار", password: "Mn%7gV1uWp!K9d", role: "expenses", color: "#f59e0b" },
      { name: "أ/ندى", password: "Nd$5jR3oZi@M8b", role: "clients", color: "#3b82f6" },
      { name: "أ/نوران", password: "Nr*6sE9aQt#H4f", role: "reports", color: "#06b6d4" },
      { name: "أ/متدرب", password: "Tr!2lP8wXc&V0g", role: "clients", color: "#94a3b8" },
    ])
    .returning();

  const nada = users.find((u) => u.name === "أ/ندى")!;
  const yomna = users.find((u) => u.name === "أ/يمنى")!;
  const manar = users.find((u) => u.name === "أ/منار")!;
  const nouran = users.find((u) => u.name === "أ/نوران")!;

  const clients = await db
    .insert(customersTable)
    .values([
      {
        name: "شركة النيل للتجارة",
        taxNumber: "123-456-789",
        entityType: "شركة",
        vatStatus: "نعم",
        phone: "01012345678",
        email: "info@nile-trade.com",
        addedById: nada.id,
        addedByName: nada.name,
      },
      {
        name: "مؤسسة الأهرام",
        taxNumber: "987-654-321",
        entityType: "فردي",
        vatStatus: "ربع سنوي",
        phone: "01198765432",
        email: "contact@ahram.eg",
        addedById: nada.id,
        addedByName: nada.name,
      },
      {
        name: "شركة الدلتا للمقاولات",
        taxNumber: "555-666-777",
        entityType: "شركة",
        vatStatus: "لا",
        phone: "01234567890",
        addedById: nada.id,
        addedByName: nada.name,
      },
    ])
    .returning();

  await db.insert(invoicesTable).values([
    {
      clientId: clients[0].id,
      clientName: clients[0].name,
      amount: "5700",
      status: "مدفوعة",
      description: "خدمات محاسبية شهرية",
      addedById: yomna.id,
      addedByName: yomna.name,
    },
    {
      clientId: clients[1].id,
      clientName: clients[1].name,
      amount: "3200",
      status: "معلقة",
      description: "استشارة مالية",
      addedById: yomna.id,
      addedByName: yomna.name,
    },
    {
      clientId: clients[2].id,
      clientName: clients[2].name,
      amount: "14250",
      status: "معلقة",
      description: "مراجعة حسابات سنوية",
      addedById: yomna.id,
      addedByName: yomna.name,
    },
  ]);

  await db.insert(expensesTable).values([
    {
      item: "إيجار المكتب",
      amount: "8000",
      category: "ايجار مكتب",
      notes: "إيجار شهر يناير",
      addedById: manar.id,
      addedByName: manar.name,
    },
    {
      item: "فاتورة الكهرباء",
      amount: "1250",
      category: "كهرباء",
      addedById: manar.id,
      addedByName: manar.name,
    },
    {
      item: "رواتب الموظفين",
      amount: "35000",
      category: "رواتب",
      addedById: manar.id,
      addedByName: manar.name,
    },
  ]);

  await db.insert(reportsTable).values([
    {
      title: "تقرير الربع الأول 2026",
      period: "يناير - مارس 2026",
      summary:
        "حقق المكتب أداءً جيداً خلال الربع الأول من العام مع زيادة في عدد العملاء بنسبة 15%، وارتفاع في الإيرادات المحققة من الخدمات المحاسبية.",
      addedById: nouran.id,
      addedByName: nouran.name,
    },
  ]);

  console.log("Seed complete");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
