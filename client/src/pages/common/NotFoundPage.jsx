import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/button';

const NotFoundPage = () => {
  return (
    <div className="h-screen flex flex-col items-center justify-center p-4">
      <h1 className="text-4xl font-bold mb-4">404</h1>
      <p className="text-lg mb-8 text-center">Page not found</p>
      <Button asChild>
        <Link to="/">Return Home</Link>
      </Button>
    </div>
  );
};

export default NotFoundPage;