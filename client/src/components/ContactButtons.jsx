import { Video, MessageCircle } from 'lucide-react';

const SLACK_ICON_SVG = (
  <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
    <path d="M14.54 2.2a2.5 2.5 0 0 0-4.73 1.19l.54 1.67-2.87.93-.54-1.67a2.5 2.5 0 0 0-4.73 1.19l.54 1.67-1.67.54a2.5 2.5 0 0 0 1.19 4.73l1.67-.54.93 2.87-1.67.54a2.5 2.5 0 0 0 1.19 4.73l1.67-.54.54 1.67a2.5 2.5 0 0 0 4.73-1.19l-.54-1.67 2.87-.93.54 1.67a2.5 2.5 0 0 0 4.73-1.19l-.54-1.67 1.67-.54a2.5 2.5 0 0 0-1.19-4.73l-1.67.54-.93-2.87 1.67-.54a2.5 2.5 0 0 0-1.19-4.73l-1.67.54-.54-1.67zM12.67 10.87l.93 2.87-2.87.93-.93-2.87 2.87-.93z" />
  </svg>
);

function getSlackUrl(slackUserId) {
  return `slack://user?user=${slackUserId}`;
}

function getSlackWebUrl(slackUserId) {
  return `https://slack.com/app_redirect?user=${slackUserId}`;
}

export default function ContactButtons({
  slackUserId,
  videoLink,
  name = '',
  size = 'sm',
  showLabels = false,
  className = '',
}) {
  if (!slackUserId && !videoLink) return null;

  const sizeClasses = size === 'xs'
    ? 'px-2 py-1 text-xs'
    : 'px-2.5 py-1.5 text-sm';

  const handleSlackClick = () => {
    if (!slackUserId) return;
    const nativeUrl = getSlackUrl(slackUserId);
    const webUrl = getSlackWebUrl(slackUserId);

    const newWindow = window.open(nativeUrl, '_blank');
    if (newWindow) {
      setTimeout(() => {
        if (newWindow.closed || !newWindow.document) {
          window.open(webUrl, '_blank');
        }
      }, 1000);
    } else {
      window.open(webUrl, '_blank');
    }
  };

  const handleVideoClick = () => {
    if (!videoLink) return;
    window.open(videoLink, '_blank');
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {slackUserId && (
        <button
          type="button"
          onClick={handleSlackClick}
          title={`Open Slack DM with ${name}`}
          className={`inline-flex items-center gap-1.5 rounded-md font-medium text-white bg-[#4A154B] hover:bg-[#3E1140] transition-colors ${sizeClasses}`}
        >
          {SLACK_ICON_SVG}
          <span>Slack{showLabels && name ? ` ${name}` : ''}</span>
        </button>
      )}
      {videoLink && (
        <button
          type="button"
          onClick={handleVideoClick}
          title={`Join video call with ${name}`}
          className={`inline-flex items-center gap-1.5 rounded-md font-medium text-white bg-green-600 hover:bg-green-700 transition-colors ${sizeClasses}`}
        >
          <Video className="h-4 w-4" />
          <span>Call{showLabels && name ? ` ${name}` : ''}</span>
        </button>
      )}
    </div>
  );
}
