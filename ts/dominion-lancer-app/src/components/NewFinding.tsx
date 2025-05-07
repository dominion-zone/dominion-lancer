import { createSignal, For } from "solid-js";
import { Button } from "terracotta";
import { UploadFile, fileUploader } from "@solid-primitives/upload";
import { createFindingMutation } from "~/mutations/createFinding";
import { useSuiNetwork, useSuiUser } from "~/contexts";
import { Network } from "~/stores/config";

const NewFinding = () => {
  const [files, setFiles] = createSignal<UploadFile[]>([]);

  const mutation = createFindingMutation();

  const network = useSuiNetwork();
  const user = useSuiUser();

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    mutation.mutateAsync({
      network: network.value as Network,
      user: user.value!,
      file: files()[0],
    });
  };

  return (
    <div>
      <h1>New Finding</h1>
      <form method="post" onsubmit={handleSubmit}>
        <input
          type="file"
          accept="application/x-tar"
          use:fileUploader={{
            userCallback: (fs) => fs.forEach((f) => console.log(f)),
            setFiles,
          }}
        />
        <Button type="submit">Create</Button>
      </form>
    </div>
  );
};

export default NewFinding;
