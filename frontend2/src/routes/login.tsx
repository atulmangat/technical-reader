import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert"


export const Route = createFileRoute('/login')({
  component: LoginPage,
})


function LoginPage() {
  const [isLogin, setIslogin] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();

  const {login, register} = useAuth();


  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {

    event.preventDefault();

    setError(null);

    const formData = new FormData(event.currentTarget);

    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    try {
      if (isLogin){
        await login(email, password);
        toast.success(
          'Login successful',{
          duration: 2000,
        });
        navigate({to: '/'});
      } else {
        const username = formData.get('username') as string;
        await register(email, password, username);
        toast.success('Registration successful! Please login.', {
          duration: 2000,
        })


        setIslogin(true);
      }
    } catch(err){
      setError(
        err instanceof Error ? err.message : 'Authentication failed',
      );
    }

  };

  return (<div className='min-h-[80vh] flex items-center justify-center'>
    <Card className='w-full max-w-md'>
      <CardHeader>
        <CardTitle>{isLogin ? 'Login': 'Register'}</CardTitle>
      </CardHeader>
      <CardContent>

        {error && (
                  <Alert variant="destructive" className="mb-4">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
        )}

        <form onSubmit={handleSubmit} className='space-y-4'>
          {!isLogin && (
            <div className='space-y-2'>
              <label htmlFor='username' className='block-text-sm font-medium'>Username</label>
              <Input id="username" name="username" type="text" required className='w-full'></Input>
            </div>
          )}

          <div className='space-y-2'>
            <label htmlFor='email' className='block text-sm font-medium'>
              Email
            </label>
            <Input id='email' name='email' type='email' required className='w-full'></Input>
          </div>

          <div className='space-y-2'>
            <label htmlFor='password' className='block text-sm font-medium'>
              Password
            </label>
            <Input id='password' name='password' type='password' required className='w-full'></Input>
          </div>

          <Button type='submit' className='w-full'>
            {isLogin ? 'Login': 'Register'}
          </Button>

        </form>

        <div className='mt-4 text-center'>
          <button type='button' onClick={() => setIslogin(!isLogin)} 
          className='text-sm text-blue-600 hover:text-blue-800'>
            {isLogin ? "Don't have an account? Register" : "Already have an account? Login"}
          </button>
        </div>
      </CardContent>
    </Card>
  </div>);
}
