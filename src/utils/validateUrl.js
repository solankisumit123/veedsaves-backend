function validateUrl(url) {
    try {
      const u = new URL(url);
      const host = u.hostname.toLowerCase();
      
      // Instagram Specific Validation
      if (host.includes('instagram.com')) {
        const path = u.pathname;
        return path.includes('/reel/') || path.includes('/p/') || path.includes('/stories/');
      }

      const supported = [
        'youtube.com', 'youtu.be',
        'tiktok.com', 'vm.tiktok.com',
        'facebook.com', 'fb.watch',
        'pinterest.com', 'pin.it',
        'x.com', 'twitter.com'
      ];
      return supported.some(d => host.includes(d));
    } catch { return false; }
}

module.exports = validateUrl;
