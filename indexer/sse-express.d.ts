// sse-express.d.ts
declare module 'sse-express' {
    import { Request, Response, NextFunction } from 'express';

    interface SSEResponse extends Response {
        sse: {
            send: (data: any, eventName?: string, id?: string | number) => void;
            event: (eventName: string, data: any, id?: string | number) => void;
            comment: (comment: string) => void;
            keepAlive: (interval?: number) => void;
            // Add other methods if you discover/use them from the sse-express library
        };
    }

    function sseExpress(req: Request, res: SSEResponse, next: NextFunction): void;
    export default sseExpress;
}