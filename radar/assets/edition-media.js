// Dated thumbnails are derived from the HTTPS image kept on the report record.
function editionImage(record, lead = false) {
  const local = (lead && record.image_local_lead) || record.image_local || "";
  const verified = record.image_match_status === "article_image" && /^https:\/\//i.test(record.image_url || "");
  return verified && /^\.\.\/assets\/editions\/\d{4}-\d{2}-\d{2}\/[a-z0-9-]+\.webp$/.test(local)
    ? local : "";
}
