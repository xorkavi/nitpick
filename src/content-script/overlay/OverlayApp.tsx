import { CommentCursor } from './CommentCursor';
import { HoverHighlight } from './HoverHighlight';
import { SelectionBox } from './SelectionBox';
import { AreaDragSelection } from './AreaDragSelection';
import { CommentBubble } from './CommentBubble';
import { Toast } from './Toast';

export function OverlayApp() {
  return (
    <>
      <HoverHighlight />
      <SelectionBox />
      <AreaDragSelection />
      <CommentBubble />
      <CommentCursor />
      <Toast />
    </>
  );
}
