/**
 * Public response mappers to ensure internal audit fields and server-side paths are never leaked.
 */

export function buildPublicProgram(row: any) {
  return {
    id: row.id,
    slug: row.slug || '',
    title: row.title,
    summary: row.summary,
    body: row.body,
    iconUrl: row.icon_url || row.icon || '',
    orderIndex: Number(row.order_index ?? row.sort_order ?? 0),
  };
}

export function buildPublicAnnouncement(row: any) {
  return {
    id: row.id,
    slug: row.slug || '',
    type: row.type,
    title: row.title,
    summary: row.summary,
    body: row.body,
    coverImage: row.cover_image_url || row.cover_image || null,
    eventStartAt: row.event_start_at || null,
    deadline: row.deadline || null,
    publishedAt: row.published_at || null,
  };
}

export function buildPublicPartner(row: any) {
  return {
    id: row.id,
    name: typeof row.name === 'object' && row.name !== null ? row.name.en || Object.values(row.name)[0] : row.name,
    website: row.website_url || row.website || null,
    logoUrl: row.logo_url || row.logo || null,
  };
}

export function buildPublicActivity(row: any) {
  let photos: string[] = [];
  if (Array.isArray(row.photos)) {
    photos = row.photos;
  } else if (typeof row.photos === 'string') {
    try {
      const parsed = JSON.parse(row.photos);
      if (Array.isArray(parsed)) photos = parsed;
    } catch {
      photos = [row.photos];
    }
  } else if (row.image_url) {
    photos = [row.image_url];
  }

  return {
    id: row.id,
    title: row.title,
    summary: row.summary || row.description || null,
    date: row.activity_date || row.date || null,
    photos,
  };
}
