import {
  ImageQuality,
  PaidAccessLevel,
  Prisma,
  PrismaClient,
} from './../src/generated';

const planData: Prisma.PlanCreateInput[] = [
  {
    id: PaidAccessLevel.FREE,
    name: 'Individuals',
    stripeProductId: null,
    description: 'Used by art lovers',
    imageQualityAllowed: ImageQuality.LOW,
    monthlyQuotaCredits: 50,
    storageQuotaMB: 500,
    maxTeamSeats: 1,
    allowHighResolution: false,
    maxResolutionWidth: null,
    maxResolutionHeight: null,
    removeWatermark: false,
    smartSuggestionsEnabled: false,
  },
  {
    id: PaidAccessLevel.ARTIST_PRO,
    name: 'Pro Artists',
    stripeProductId: process.env.STRIPE_ARTIST_PRODUCT_ID, // Script context: using process.env is acceptable here
    description: 'Great for small businesses',
    imageQualityAllowed: ImageQuality.HIGH,
    monthlyQuotaCredits: 1500,
    storageQuotaMB: 50000,
    maxTeamSeats: 1,
    allowHighResolution: true,
    maxResolutionWidth: 4096,
    maxResolutionHeight: 4096,
    removeWatermark: true,
    smartSuggestionsEnabled: true,
  },
  {
    id: PaidAccessLevel.STUDIO,
    name: 'Studios',
    stripeProductId: process.env.STRIPE_STUDIO_PRODUCT_ID, // Script context: using process.env is acceptable here
    description: 'Great for large businesses',
    imageQualityAllowed: ImageQuality.HIGH,
    monthlyQuotaCredits: 4500,
    storageQuotaMB: 250000,
    maxTeamSeats: 5,
    allowHighResolution: true,
    maxResolutionWidth: 8192,
    maxResolutionHeight: 8192,
    removeWatermark: true,
    smartSuggestionsEnabled: true,
  },
];

const prisma = new PrismaClient();

async function main() {
  console.log(`Seeding roles...`);
  const adminRole = await prisma.role.upsert({
    where: { roleName: 'ADMIN' },
    update: {},
    create: {
      roleName: 'ADMIN',
    },
  });

  const userRole = await prisma.role.upsert({
    where: { roleName: 'USER' },
    update: {},
    create: {
      roleName: 'USER',
    },
  });
  console.log(`Roles seeded: ${adminRole.roleName}, ${userRole.roleName}`);

  for (const p of planData) {
    const plan = await prisma.plan.upsert({
      where: { id: p.id },
      update: p,
      create: p,
    });
    console.log(`Created or updated plan with id: ${plan.id}`);
  }



  // Seed Blogs with upsert by ID
  // const blogSeeds = [
  //   {
  //     id: 1,
  //     userId: 'jris1kLjcEOimrlKjGQexf65kV32',
  //     title: 'Exploring the Alps: A Photographic Journey (Tiptap Edition)',
  //     content: `<h1>Alps Journey</h1><p>Photos and experiences in the Alps.</p>`,
  //     isPublished: true,
  //     pictures: [
  //       'https://example.com/alps1.jpg',
  //       'https://example.com/alps2.jpg',
  //     ],
  //     embeddedVideos: [],
  //   },
  //   {
  //     id: 2,
  //     userId: 'wlkJWoJiOwV5vDjKfwAqCOB24Iw1',
  //     title: 'Urban Exploration: The Hidden Gems (Tiptap)',
  //     content: `<h1>Urban Gems</h1><p>Exploring hidden spots in the city.</p>`,
  //     isPublished: true,
  //     pictures: [
  //       'https://example.com/urban1.jpg',
  //       'https://example.com/urban2.jpg',
  //     ],
  //     embeddedVideos: [],
  //   },
  // ];

  // for (const b of blogSeeds) {
  //   await prisma.blog.upsert({
  //     where: { id: b.id }, // upsert by primary key
  //     update: {
  //       title: b.title,
  //       content: b.content,
  //       isPublished: b.isPublished,
  //       pictures: b.pictures,
  //       embeddedVideos: b.embeddedVideos,
  //       userId: b.userId, // ← update uses scalar FK too
  //     },
  //     create: {
  //       id: b.id,
  //       userId: b.userId, // ← supply FK scalar here
  //       title: b.title,
  //       content: b.content,
  //       isPublished: b.isPublished,
  //       pictures: b.pictures,
  //       embeddedVideos: b.embeddedVideos,
  //     },
  //   });
  //   console.log(`Upserted blog ${b.id}: ${b.title}`);
  // }

  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
