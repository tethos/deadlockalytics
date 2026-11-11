import { TabHeader, Placeholder } from "../components/common";

// Tabs are filled in milestone by milestone; each re-exports from its own file once built.
const stub = (title: string, milestone: number, what: string) => () => (
  <>
    <TabHeader title={title} eyebrow="Under construction" />
    <Placeholder milestone={milestone} what={what} />
  </>
);

export { StartHere } from "./StartHere";
export { Timeline } from "./Timeline";
export { MapTab } from "./MapTab";
export { Heroes } from "./Heroes";
export { Items } from "./Items";
export { Stats } from "./Stats";
export { Settings } from "./Settings";
export const Videos = stub("Video Lessons", 6, "embedded beginner guides from after the City Never Sleeps update.");
export { Mistakes } from "./Mistakes";
