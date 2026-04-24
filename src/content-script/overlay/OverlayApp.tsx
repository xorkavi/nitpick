import { CommentCursor } from './CommentCursor';
import { HoverHighlight } from './HoverHighlight';
import { SelectionBox } from './SelectionBox';

export function OverlayApp() {
  return (
    <>
      <HoverHighlight />
      <SelectionBox />
      <CommentCursor />
    </>
  );
}
