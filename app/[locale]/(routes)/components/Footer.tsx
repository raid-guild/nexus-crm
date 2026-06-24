import getNextVersion from "@/actions/system/get-next-version";
import Link from "next/link";
import { version } from "@/package.json";

const Footer = async () => {
  const nextVersion = await getNextVersion();
  //console.log(nextVersion, "nextVersion");
  return (
    <footer className="flex flex-row h-8 justify-end items-center w-full text-xs text-muted-foreground p-5">
      <div className="hidden md:flex pr-5">
        <Link href="/">
          <h1 className="text-muted-foreground hover:text-foreground transition-colors">
            {process.env.NEXT_PUBLIC_APP_NAME} - v{version}
          </h1>
        </Link>
      </div>
    </footer>
  );
};

export default Footer;
