const BASE_URL="https://backend-a9pu.onrender.com/api/v1";

async function register(){

const name=document.getElementById("regName").value;
const email=document.getElementById("regEmail").value;
const password=document.getElementById("regPassword").value;
const confirmPassword=document.getElementById("regConfirmPassword").value;
const role=document.getElementById("role").value;
const adminCode=document.getElementById("adminCode").value;

if(!name||!email||!password||!confirmPassword){
alert("Please fill all fields");
return;
}

if(password!==confirmPassword){
alert("Passwords do not match");
return;
}

const res=await fetch(`${BASE_URL}/auth/register`,{
method:"POST",
headers:{
"Content-Type":"application/json"
},
body:JSON.stringify({
name,
email,
password,
role,
adminCode
})
});

const data=await res.json();

if(!res.ok){
alert(data.message||"Registration failed");
return;
}

alert("Registration successful");
window.location.href="index.html";
}

async function login(){

const email=document.getElementById("email").value;
const password=document.getElementById("password").value;

if(!email||!password){
alert("Fill all fields");
return;
}

const res=await fetch(`${BASE_URL}/auth/login`,{
method:"POST",
headers:{
"Content-Type":"application/json"
},
body:JSON.stringify({
email,
password
})
});

const data=await res.json();

if(!res.ok||!data.token){
alert(data.message||"Login failed");
return;
}

localStorage.setItem("token",data.token);
localStorage.setItem("role",data.user.role);

if(data.user.role==="ADMIN"){
window.location.href="admin.html";
}else{
window.location.href="employee.html";
}
}

async function createAnnouncement(){

const title=document.getElementById("title").value;
const description=document.getElementById("description").value;
const expiryDate=document.getElementById("expiryDate").value;

if(!title||!description||!expiryDate){
alert("Fill all fields");
return;
}

const res=await fetch(`${BASE_URL}/announcements`,{
method:"POST",
headers:{
"Content-Type":"application/json",
"Authorization":`Bearer ${localStorage.getItem("token")}`
},
body:JSON.stringify({
title,
description,
expiryDate
})
});

const data=await res.json();

if(!res.ok){
alert(data.message||"Failed");
return;
}

alert("Announcement created");
loadAnnouncements();
}

async function loadAnnouncements(){

const res=await fetch(`${BASE_URL}/announcements`,{
headers:{
"Authorization":`Bearer ${localStorage.getItem("token")}`
}
});

if(res.status===401){
alert("Session expired");
logout();
return;
}

const data=await res.json();

const list=document.getElementById("list");

if(!list)return;

list.innerHTML="";

data.forEach(a=>{

list.innerHTML+=`

<div class="card">

<h3>${a.title}</h3>
<p>${a.description}</p>
<small>Expires: ${new Date(a.expiryDate).toLocaleDateString()}</small>

${localStorage.getItem("role")==="ADMIN" ? `

<br><br>

<button onclick="editAnnouncement('${a._id}')">Edit</button>
<button onclick="deleteAnnouncement('${a._id}')">Delete</button>

` : ""}

</div>

`;
});
}

async function deleteAnnouncement(id){

if(!confirm("Delete this announcement?"))return;

const res=await fetch(`${BASE_URL}/announcements/${id}`,{
method:"DELETE",
headers:{
"Authorization":`Bearer ${localStorage.getItem("token")}`
}
});

const data=await res.json();

if(!res.ok){
alert(data.message||"Delete failed");
return;
}

alert("Deleted");
loadAnnouncements();
}

async function editAnnouncement(id){

const title=prompt("New title");
const description=prompt("New description");
const expiryDate=prompt("New expiry date YYYY-MM-DD");

const res=await fetch(`${BASE_URL}/announcements/${id}`,{
method:"PUT",
headers:{
"Content-Type":"application/json",
"Authorization":`Bearer ${localStorage.getItem("token")}`
},
body:JSON.stringify({
title,
description,
expiryDate
})
});

const data=await res.json();

if(!res.ok){
alert(data.message||"Update failed");
return;
}

alert("Updated");
loadAnnouncements();
}

function logout(){
localStorage.clear();
window.location.href="index.html";
}

if(document.getElementById("list")){
loadAnnouncements();
}