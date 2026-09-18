import { Button } from '@/components/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';

// One React-style source file is rendered by both framework apps.
export default function PastedButtonGroup() {
  const [archived, setArchived] = useState(false);
  return (
    <ButtonGroup aria-label="Document actions">
      <Button variant="outline" onClick={() => setArchived(!archived)}>
        {archived ? 'Archived' : 'Archive'}
      </Button>
      <Button variant="outline">Report</Button>
    </ButtonGroup>
  );
}
import { useState } from 'react';
