import 'react';

declare module 'react' {
    namespace JSX {
        interface IntrinsicElements {
            'ic-spectrum-canvas': React.DetailedHTMLProps<
                React.HTMLAttributes<HTMLElement>,
                HTMLElement
            >;
            'ic-spectrum-penbar-laser-pointer': React.DetailedHTMLProps<
                React.HTMLAttributes<HTMLElement>,
                HTMLElement
            >;
            'ic-spectrum-penbar-eraser': React.DetailedHTMLProps<
                React.HTMLAttributes<HTMLElement>,
                HTMLElement
            >;
            'ic-spectrum-taskbar-chat': React.DetailedHTMLProps<
                React.HTMLAttributes<HTMLElement>,
                HTMLElement
            >;
            'ic-spectrum-taskbar-chat-panel': React.DetailedHTMLProps<
                React.HTMLAttributes<HTMLElement>,
                HTMLElement
            >;
            'ic-spectrum-context-image-edit-bar': React.DetailedHTMLProps<
                React.HTMLAttributes<HTMLElement> & {
                    node: any;
                },
                HTMLElement
            >;
        }
    }
}

