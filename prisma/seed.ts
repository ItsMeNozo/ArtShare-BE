import {
  CategoryType,
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

  // Seed Categories
  const categories = [
    {
      name: 'Oil Painting',
      description:
        'Artworks created using oil-based paints. Known for rich colors and texture.',
      exampleImages: [
        'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8b2lsJTIwcGFpbnRpbmd8ZW58MHx8MHx8fDA%3D&auto=format&fit=crop&w=500&q=60',
        'https://images.unsplash.com/photo-1547891654-e66ed7ebb968?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NHx8b2lsJTIwcGFpbnRpbmd8ZW58MHx8MHx8fDA%3D&auto=format&fit=crop&w=500&q=60',
      ],
      type: CategoryType.MEDIUM,
    },
    {
      name: 'Watercolor',
      description:
        'Paintings made with water-soluble pigments. Often translucent and delicate.',
      exampleImages: [
        'https://images.unsplash.com/photo-1617503752587-97d2103a96ea?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8d2F0ZXJjb2xvciUyMGFydHxlbnwwfHwwfHx8MA%3D%3D&auto=format&fit=crop&w=500&q=60',
      ],
      type: CategoryType.MEDIUM,
    },
    {
      name: 'Abstract',
      description:
        'Art that does not attempt to represent external reality, seeking to achieve its effect using shapes, forms, colors, and textures.',
      exampleImages: [
        'https://images.unsplash.com/photo-1502759493049-a034cb995520?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Nnx8YWJzdHJhY3QlMjBhcnR8ZW58MHx8MHx8fDA%3D&auto=format&fit=crop&w=500&q=60',
      ],
      type: CategoryType.ATTRIBUTE,
    },
    {
      name: 'Portraiture',
      description:
        'The art of creating portraits; representations of a person, especially one showing the face.',
      exampleImages: [],
      type: CategoryType.ATTRIBUTE,
    },
    {
      name: 'Digital Art',
      description:
        'Artistic work or practice that uses digital technology as part of the creative or presentation process.',
      exampleImages: [
        'https://images.unsplash.com/photo-1611162617213-6d22e5050089?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8ZGlnaXRhbCUyMGFydHxlbnwwfHwwfHx8MA%3D%3D&auto=format&fit=crop&w=500&q=60',
      ],
      type: CategoryType.MEDIUM,
    },
    {
      name: 'Surrealism',
      description:
        'A 20th-century avant-garde movement in art and literature which sought to release the creative potential of the unconscious mind.',
      exampleImages: [],
      type: CategoryType.ATTRIBUTE,
    },
    {
      name: 'Impressionism',
      description:
        'A 19th-century art movement characterized by relatively small, thin, yet visible brush strokes, open composition, emphasis on accurate depiction of light in its changing qualities.',
      exampleImages: [
        'https://images.unsplash.com/photo-1547891654-e66ed7ebb968?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTJ8fGltcHJlc3Npb25pc20lMjBhcnR8ZW58MHx8MHx8fDA%3D&auto=format&fit=crop&w=500&q=60',
        'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTZ8fGltcHJlc3Npb25pc20lMjBhcnR8ZW58MHx8MHx8fDA%3D&auto=format&fit=crop&w=500&q=60',
      ],
      type: CategoryType.ATTRIBUTE,
    },
    {
      name: 'Botanical',
      description:
        'Art that depicts plants, flowers, and other botanical subjects.',
      exampleImages: [
        'https://images.unsplash.com/photo-1560969184-10fe8719e047?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NXx8Ym90YW5pY2FsJTIwYXJ0fGVufDB8fDB8fHww&auto=format&fit=crop&w=500&q=60',
        'https://images.unsplash.com/photo-1468327768560-75b714cbb750?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8Ym90YW5pY2FsJTIwYXJ0fGVufDB8fDB8fHww&auto=format&fit=crop&w=500&q=60',
      ],
      type: CategoryType.ATTRIBUTE,
    },
    {
      name: 'Acrylic Painting',
      description:
        'Artworks created using fast-drying acrylic paints. Versatile and can mimic watercolor or oil.',
      exampleImages: [
        'https://images.unsplash.com/photo-1617503752587-97d2103a96ea?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8YWNyeWxpYyUyMHBhaW50aW5nfGVufDB8fDB8fHww&auto=format&fit=crop&w=500&q=60',
        'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MXx8YWNyeWxpYyUyMHBhaW50aW5nfGVufDB8fDB8fHww&auto=format&fit=crop&w=500&q=60',
      ],
      type: CategoryType.MEDIUM,
    },
    {
      name: 'Sculpture',
      description:
        'Three-dimensional art objects created by shaping or combining hard materials, typically stone, metal, glass, or wood.',
      exampleImages: [
        'https://images.unsplash.com/photo-1589083114952-270f09730789?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8c2N1bHB0dXJlfGVufDB8fDB8fHww&auto=format&fit=crop&w=500&q=60',
        'https://images.unsplash.com/photo-1600703140489-391993035881?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NXx8c2N1bHB0dXJlfGVufDB8fDB8fHww&auto=format&fit=crop&w=500&q=60',
      ],
      type: CategoryType.MEDIUM,
    },
    {
      name: 'Drawing',
      description:
        'Art created using drawing instruments such as pencils, crayons, charcoal, pastels, or markers.',
      exampleImages: [
        'https://images.unsplash.com/photo-1588087021018-a7db455c0502?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8ZHJhd2luZ3xlbnwwfHwwfHx8MA%3D%3D&auto=format&fit=crop&w=500&q=60',
        'https://images.unsplash.com/photo-1600289031464-749778850412?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8M3x8ZHJhd2luZ3xlbnwwfHwwfHx8MA%3D%3D&auto=format&fit=crop&w=500&q=60',
      ],
      type: CategoryType.MEDIUM,
    },
    {
      name: 'Photography',
      description:
        'The art, application, and practice of creating durable images by recording light, either electronically or chemically.',
      exampleImages: [
        'https://images.unsplash.com/photo-1502982720700-bfff97f2ecac?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8cGhvdG9ncmFwaHl8ZW58MHx8MHx8fDA%3D&auto=format&fit=crop&w=500&q=60',
        'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NHx8cGhvdG9ncmFwaHl8ZW58MHx8MHx8fDA%3D&auto=format&fit=crop&w=500&q=60',
      ],
      type: CategoryType.MEDIUM,
    },
    {
      name: 'Printmaking',
      description:
        'The process of creating artworks by printing, normally on paper. Includes techniques like etching, lithography, and screenprinting.',
      exampleImages: [
        'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTh8fGFydCUyMHByaW50bWFraW5nfGVufDB8fDB8fHww&auto=format&fit=crop&w=500&q=60', // Generic art, good for placeholder
        'https://plus.unsplash.com/premium_photo-1670274600835-1a31756f5316?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MXx8bGlub2N1dHxlbnwwfHwwfHx8MA%3D%3D&auto=format&fit=crop&w=500&q=60',
      ],
      type: CategoryType.MEDIUM,
    },
    {
      name: 'Collage',
      description:
        'Art made from an assemblage of different forms, thus creating a new whole. Often involves paper, photographs, and found objects.',
      exampleImages: [
        'https://images.unsplash.com/photo-1600703140489-391993035881?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTB8fGNvbGxhZ2UlMjBhcnR8ZW58MHx8MHx8fDA%3D&auto=format&fit=crop&w=500&q=60',
        'https://images.unsplash.com/photo-1598653331863-f22170240642?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NHx8Y29sbGFnZSUyMGFydHxlbnwwfHwwfHx8MA%3D%3D&auto=format&fit=crop&w=500&q=60',
      ],
      type: CategoryType.MEDIUM,
    },
    {
      name: 'Textile Art',
      description:
        'Arts and crafts that use plant, animal, or synthetic fibers to construct practical or decorative objects.',
      exampleImages: [
        'https://images.unsplash.com/photo-1561427599-0036985709f0?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8dGV4dGlsZSUyMGFydHxlbnwwfHwwfHx8MA%3D%3D&auto=format&fit=crop&w=500&q=60',
        'https://images.unsplash.com/photo-1618220779903-c90391571139?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8M3x8dGV4dGlsZSUyMGFydHxlbnwwfHwwfHx8MA%3D%3D&auto=format&fit=crop&w=500&q=60',
      ],
      type: CategoryType.MEDIUM,
    },
    {
      name: 'Mixed Media',
      description:
        'Artworks composed from a combination of different media or materials.',
      exampleImages: [
        'https://images.unsplash.com/photo-1541754959794-4f00c700f6c6?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8bWl4ZWQlMjBtZWRpYSUyMGFydHxlbnwwfHwwfHx8MA%3D%3D&auto=format&fit=crop&w=500&q=60',
        'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8M3x8bWl4ZWQlMjBtZWRpYSUyMGFydHxlbnwwfHwwfHx8MA%3D%3D&auto=format&fit=crop&w=500&q=60',
      ],
      type: CategoryType.MEDIUM,
    },
    {
      name: 'Ceramics',
      description:
        'Art made from ceramic materials, including clay. It may take forms including artistic pottery, tableware, tiles, figurines and other sculpture.',
      exampleImages: [
        'https://images.unsplash.com/photo-1560969184-10fe8719e047?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8Y2VyYW1pY3N8ZW58MHx8MHx8fDA%3D&auto=format&fit=crop&w=500&q=60',
        'https://images.unsplash.com/photo-1525946532003-aa30d857589a?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NHx8Y2VyYW1pY3N8ZW58MHx8MHx8fDA%3D&auto=format&fit=crop&w=500&q=60',
      ],
      type: CategoryType.MEDIUM,
    },
    {
      name: 'Pastel',
      description:
        'An art medium in the form of a stick, consisting of powdered pigment and a binder. Known for soft, subtle colors.',
      exampleImages: [
        'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?ixid=MnwxMjA3fDB8MHxzZWFyY2h8MXx8cGFzdGVsJTIwYXJ0fGVufDB8fDB8fA%3D%3D&auto=format&fit=crop&w=500&q=60', // Using a similar image to oil, but concept applies
        'https://images.unsplash.com/photo-1617503752587-97d2103a96ea?ixid=MnwxMjA3fDB8MHxzZWFyY2h8MXx8cGFzdGVsJTIwY29sb3JzfGVufDB8fDB8fA%3D%3D&auto=format&fit=crop&w=500&q=60', // Pastel colors
      ],
      type: CategoryType.MEDIUM,
    },
    {
      name: 'Gouache',
      description:
        'A type of watermedia, paint consisting of pigment, water, a binding agent (usually gum arabic), and sometimes additional inert material. Gouache is designed to be opaque.',
      exampleImages: [
        'https://images.unsplash.com/photo-1628260412296-952450303710?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MXx8Z291YWNoZSUyMHBhaW50aW5nfGVufDB8fDB8fHww&auto=format&fit=crop&w=500&q=60',
        'https://images.unsplash.com/photo-1618220779903-c90391571139?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTF8fGdvdWFjaGV8ZW58MHx8MHx8fDA%3D&auto=format&fit=crop&w=500&q=60',
      ],
      type: CategoryType.MEDIUM,
    },
    {
      name: 'Installation Art',
      description:
        'Large-scale, mixed-media constructions, often designed for a specific place or for a temporary period of time.',
      exampleImages: [
        'https://images.unsplash.com/photo-1505692069807-b27b0a5004aa?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8aW5zdGFsbGF0aW9uJTIwYXJ0fGVufDB8fDB8fHww&auto=format&fit=crop&w=500&q=60',
        'https://images.unsplash.com/photo-1517064099987-a34a0a865536?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8M3x8aW5zdGFsbGF0aW9uJTIwYXJ0fGVufDB8fDB8fHww&auto=format&fit=crop&w=500&q=60',
      ],
      type: CategoryType.MEDIUM,
    },
    {
      name: 'Video Art',
      description:
        'Art form which relies on using video technology as a visual and audio medium.',
      exampleImages: [
        'https://images.unsplash.com/photo-1542206395-9feb3edaa68d?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8dmlkZW8lMjBhcnR8ZW58MHx8MHx8fDA%3D&auto=format&fit=crop&w=500&q=60',
        'https://images.unsplash.com/photo-1516245834210-c4c1427873AB?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8M3x8dmlkZW8lMjBhcnR8ZW58MHx8MHx8fDA%3D&auto=format&fit=crop&w=500&q=60',
      ],
      type: CategoryType.MEDIUM,
    },
  ];

  for (const category of categories) {
    await prisma.category.upsert({
      where: { name: category.name },
      update: {},
      create: category,
    });
  }
  console.log('Seeded categories');

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
