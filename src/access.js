import fetch from "node-fetch";

async function getAccounts(token) {
    const hubsEndpoint = "https://developer.api.autodesk.com/project/v1/hubs";
    const res = await fetch(hubsEndpoint, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      }
    });
  
    const data = await res.json();
    return data.data;
  }
  
  async function getProjects(account, token) {
    const projectsEndpoint = "https://developer.api.autodesk.com/project/v1/hubs/" + account + "/projects";
    const res = await fetch(projectsEndpoint, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      }
    });
  
    const data = await res.json();
    return data.data;
  }
  
  async function getFolders(account, project, token) {
    const foldersEndpoint = "https://developer.api.autodesk.com/project/v1/hubs/" + account + "/projects/" + project + "/topFolders"
    const res = await fetch(foldersEndpoint, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      }
    });
  
    const data = await res.json();
    if (data.data.length > 0 && data.data[0].attributes.name === "Project Files") {
      return await getProjectFolders(data.data[0].id, project, token);
    }
    return data.data;
  }
  
  async function getProjectFolders(folderId, project, token) {
    const projectId = project;
    const foldersEndpoint = "https://developer.api.autodesk.com/data/v1/projects/" + projectId + "/folders/" + encodeURIComponent(folderId) + "/contents";
    const res = await fetch(foldersEndpoint, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      }
    });
  
    const data = await res.json();
    return data.data;
  }
  
  async function getAccessId(project, folder, delimiter) {
    const projectId = project.split(".")[1];
    return encodeURIComponent(projectId + delimiter + folder);
  }

  export { getAccounts, getProjects, getFolders, getProjectFolders, getAccessId };