import { getAuth } from "@/lib/auth";

const handler = (request: Request) => getAuth().handler(request);

export { handler as GET, handler as POST };
