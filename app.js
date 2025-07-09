let menuIcon = document.querySelector("#menu-icon");
let navbar = document.querySelector(".navbar");
let section = document.querySelectorAll("section");
let navlinks = document.querySelectorAll("header nav a");

window.onscroll = () => {
    section.forEach(sec => {
        let top = window.scrollY;
        let offset = sec.offsetTop - 150; // Adjust the offset for better scrolling experience
        let height = sec.offsetHeight;
        let id = sec.getAttribute("id"); // Fix here: Correctly get the 'id' attribute of each section

        if (top >= offset && top < offset + height) {
            navlinks.forEach(link => {
                link.classList.remove("active");
                document.querySelector("header nav a[href*='" + id + "']").classList.add("active");
            });
        }
    });
};

menuIcon.onclick = () => {
    menuIcon.classList.toggle('bx-x');
    navbar.classList.toggle('active');
};
