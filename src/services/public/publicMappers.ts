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
    icon: row.icon || '',
    iconUrl: row.icon_url || '',
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
    coverImageUrl: row.cover_image_url || row.cover_image || null,
    location: row.location || null,
    organizationName: row.organization_name || null,
    attachmentUrl: row.attachment_url || null,
    externalLink: row.external_link || null,
    eventEndAt: row.event_end_at || null,
    registrationOpen: Boolean(row.registration_open),
    registrationUrl: row.registration_url || null,
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
    description: row.description || row.summary || null,
    date: row.activity_date || row.date || null,
    activityDate: row.activity_date || row.date || null,
    location: row.location || null,
    photos,
  };
}
