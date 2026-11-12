import { mergeAttributes, Node } from '@tiptap/core';
import { VueNodeViewRenderer } from '@tiptap/vue-3';
import VideoBlockNodeView from '@/components/VideoBlockNodeView.vue';

export interface VideoBlockOptions {
  HTMLAttributes: Record<string, unknown>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    videoBlock: {
      setVideoBlock: (options: { src: string; caption?: string }) => ReturnType;
    };
  }
}

export const VideoBlock = Node.create<VideoBlockOptions>({
  name: 'videoBlock',
  group: 'block',
  atom: true,
  draggable: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      src: {
        default: null,
      },
      caption: {
        default: '',
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-video-block]',
        getAttrs: (element) => {
          if (typeof element === 'string') return false;
          const videoEl = element.querySelector('video');
          return {
            src: videoEl?.getAttribute('src') || element.getAttribute('data-src'),
            caption: element.getAttribute('data-caption') || '',
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, {
        'data-video-block': 'true',
        'data-src': HTMLAttributes.src,
        'data-caption': HTMLAttributes.caption || '',
      }),
      [
        'video',
        {
          src: HTMLAttributes.src,
          controls: 'true',
          playsinline: 'true',
        },
      ],
    ];
  },

  addCommands() {
    return {
      setVideoBlock:
        (options) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: {
              src: options.src,
              caption: options.caption ?? '',
            },
          });
        },
    };
  },

  addNodeView() {
    return VueNodeViewRenderer(VideoBlockNodeView);
  },
});
