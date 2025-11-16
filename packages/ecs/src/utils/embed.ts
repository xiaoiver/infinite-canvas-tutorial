export const convertYoutubeEmbedUrl = (urlObj: URL) => {
  let embedUrl = urlObj.toString();
  const hostname = urlObj.hostname.replace(/^www./, '');
  if (hostname === 'youtu.be') {
    const videoId = urlObj.pathname.split('/').filter(Boolean)[0];
    const searchParams = new URLSearchParams(urlObj.search);
    const timeStart = searchParams.get('t');
    if (timeStart) {
      searchParams.set('start', timeStart);
      searchParams.delete('t');
    }
    const search = searchParams.toString() ? '?' + searchParams.toString() : '';
    embedUrl = `https://www.youtube.com/embed/${videoId}${search}`;
  } else if (
    (hostname === 'youtube.com' || hostname === 'm.youtube.com') &&
    urlObj.pathname.match(/^\/watch/)
  ) {
    const videoId = urlObj.searchParams.get('v');
    const searchParams = new URLSearchParams(urlObj.search);
    searchParams.delete('v');
    const timeStart = searchParams.get('t');
    if (timeStart) {
      searchParams.set('start', timeStart);
      searchParams.delete('t');
    }
    const search = searchParams.toString() ? '?' + searchParams.toString() : '';
    embedUrl = `https://www.youtube.com/embed/${videoId}${search}`;
  }
  return embedUrl;
};
