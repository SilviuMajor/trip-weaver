import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import Brand from '@/components/Brand';

const NotFound = () => {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center"
      >
        <div className="mb-4 text-6xl">🧭</div>
        <h1 className="mb-2 text-2xl font-bold">Looks like you're off the map</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          This page doesn't exist — but your next adventure does.
        </p>
        <Button onClick={() => navigate('/')}>
          Take me home
        </Button>
        <div className="mt-8">
          <Brand size="sm" className="opacity-40" />
        </div>
      </motion.div>
    </div>
  );
};

export default NotFound;
