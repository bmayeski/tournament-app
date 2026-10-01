export function getSiteColor(siteName) {
  if (!siteName) return 'var(--accent-orange)';
  const site = siteName.toLowerCase();
  if (site.includes('valhalla')) return '#FF5F00';
  if (site.includes('granite')) return '#3F98CC'; 
  if (site.includes('christian')) return '#BF2A39';
  return 'var(--accent-orange)'; 
}

export function getScoreStyle(score1, score2) {
  const s1 = parseInt(score1);
  const s2 = parseInt(score2);
  if (!isNaN(s1) && !isNaN(s2)) {
    if (s1 > s2) return "color: var(--accent-orange); font-weight: 600;";
    if (s1 < s2) return "color: var(--text-secondary); font-weight: normal;";
  }
  return "color: var(--text-primary); font-weight: 500;"; 
}

export function lightenColor(color, percent) {
  if (!color || !color.includes('#')) return '#F8FAFC';
  const num = parseInt(color.replace('#', ''), 16),
        amt = Math.round(2.55 * (percent * 100)),
        R = (num >> 16) + amt, G = (num >> 8 & 0x00FF) + amt, B = (num & 0x0000FF) + amt;
  return "#" + (0x1000000 + (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 + (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 + (B < 255 ? (B < 1 ? 0 : B) : 255)).toString(16).slice(1);
}

export function ensureReadableColor(colorHex) {
    if (!colorHex || !colorHex.includes('#')) return '#F8FAFC';
    
    // Convert hex to RGB
    let num = parseInt(colorHex.replace('#', ''), 16);
    let r = (num >> 16) & 0xFF;
    let g = (num >> 8) & 0xFF;
    let b = num & 0xFF;
    
    // Calculate perceived brightness (luminance)
    let luma = 0.2126 * r + 0.7152 * g + 0.0722 * b; 
    
    // If the color is too dark for a navy background, lighten it by 45%
    if (luma < 90) {
        return lightenColor(colorHex, 0.45);
    }
    
    return colorHex; 
}

export const addMinutes = (timeStr, minsToAdd) => {
    if (!timeStr) return '00:00';
    const [h, m] = timeStr.split(':').map(Number);
    const date = new Date(2000, 0, 1, h, m + minsToAdd, 0);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
};

export const formatTime = (timeStr) => {
    if (!timeStr || typeof timeStr !== 'string') return 'TBD';
    if (timeStr.includes('AM') || timeStr.includes('PM')) return timeStr;
    
    const parts = timeStr.split(':');
    if (parts.length < 2) return timeStr;
    
    let h = parseInt(parts[0], 10);
    let m = parseInt(parts[1], 10);
    if (isNaN(h) || isNaN(m)) return 'TBD';
    
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${m.toString().padStart(2, '0')} ${ampm}`;
};

export const getOrdinalSuffix = (i) => {
    const j = i % 10, k = i % 100;
    if (j == 1 && k != 11) return i + "st";
    if (j == 2 && k != 12) return i + "nd";
    if (j == 3 && k != 13) return i + "rd";
    return i + "th";
};

export const timeToMinutes = (timeStr) => {
    if (!timeStr) return 480; 
    const [hours, minutes] = timeStr.split(':').map(Number);
    return (hours * 60) + (minutes || 0);
};

export const minutesToTimeStr = (totalMinutes) => {
    const hours = Math.floor(totalMinutes / 60) % 24;
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};