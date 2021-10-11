const User = require('../models/User.model');
const {Subjects, createTopic} = require('../models/subjects.model');
const {registeredSubjects, createSubjectInstanceForEnrolling} = require('../models/registeredSubjects.model');
const bcrypt = require('bcryptjs');
const passport = require("passport");
const {outerUnion, innerUnion} = require('../utilities/getUnionFunctions.js');
const { create } = require('../models/User.model');
const  {generateQuestion, QuestionBank, checkQuestionsAnswer}= require('../models/Questions/questions.model');

const getLogin = (req, res)=>{
    res.render("users/login.ejs", {error: req.flash("error")});
};

const postLogin = (req, res, next) => {
    passport.authenticate("userLocal", {
      successRedirect: "/users/dashboard",
      failureRedirect: "/users/login",
      failureFlash: true,
    })(req, res, next);
  };

const getRegister = (req, res)=>{
    res.render("users/register.ejs", {errors:req.flash('errors')});
};

const postRegister = (req, res)=>{
    const { name, email, password, confirm_password } = req.body;

//Data Validation
    const errors = [];
    if (!name || !email || !password || !confirm_password) {
        errors.push("All fields are required!");
    }
    if (password.length < 6) {
        errors.push("Password must be at least 6 characters!");
    }
    if (password !== confirm_password) {
        errors.push("Passwords do not match!");
    }
    if (errors.length > 0) {
        req.flash("errors", errors);
        res.redirect("/users/register");
    } else {

//Create New User
User.findOne({ email: email }).then((user) => {
    if (user) {
      errors.push("User already exists with this email!");
      req.flash("errors", errors);
      res.redirect("/users/register");
    } else {
      bcrypt.genSalt(10, (err, salt) => {
        if (err) {
          errors.push(err);
          req.flash("errors", errors);
          res.redirect("/users/register");
        } else {
          bcrypt.hash(password, salt, (err, hash) => {
            if (err) {
              errors.push(err);
              req.flash("errors", errors);
              res.redirect("/users/register");
            } else {
              const newUser = new User({
                name,
                email,
                password: hash,
              });
              newUser
                .save()
                .then(() => {
                  let newEntry = new registeredSubjects();
                  newEntry.email = newUser.email;
                  newEntry.subjects = [];
                  newEntry.save().then(()=>{res.redirect("/users/login");})
                  
                })
                .catch((e) => {
                  errors.push("Saving User to the database failed!");
                  console.log(e);
                  req.flash("errors", errors);
                  res.redirect("/users/register");
                });
            }
          });
        }
      });
    }
  });
  }
};

const getDashboard = (req, res) => {
  const userEmail = req.user.email;
  registeredSubjects.findOne({email: userEmail}, (err, data)=>{
    res.render("users/dashboard.ejs", { user: req.user, subjectsRegistered: data.subjects });
  }).catch((error)=>{
    console.log(error);
    res.render("users/dashboard.ejs", { user: req.user,  subjectsRegistered: []});
  });
  
}

const getSearchPage = (req, res) => {
  Subjects.find().then((data)=>{
    const allSubjects = data;
    registeredSubjects.findOne({email: req.user.email}, (error, registeredSubjectsListData)=>{
        if(error){
          console.log("DataBase Error. Subjects Junction Table: NO DATA\n");
          res.redirect("/users/dashboard");
        }
        else{
          const registeredSubjectsList = registeredSubjectsListData.subjects;

          console.log("registeredSubjectsList:", registeredSubjectsList);

          const subjectsToDisplay = outerUnion(registeredSubjectsList, allSubjects);

          console.log("subjectsToDisplay", subjectsToDisplay);
         
          res.render("users/searchPage.ejs", { user: req.user,  subjectsList: subjectsToDisplay});
        }
    })
    
  }).catch((error)=>{
      console.log(error);
      res.render("users/searchPage.ejs", { user: req.user,  subjectsList: []});
    }
  )
}


const enrollUser = (req, res) => {
    const userEmail = req.params.useremail;
    const subject = req.params.subject;
    console.log("Enrolling");
    console.log(userEmail, subject);

    const toAdd = createSubjectInstanceForEnrolling(subject)
    registeredSubjects.findOneAndUpdate({email: userEmail}, {$push: {subjects: toAdd}}, (error,success)=>{
      if (error) {
        console.log(error);
        res.redirect("/users/dashboard");
      } else {
        res.redirect("/users/searchpage");
      }
    })
}

const getCoursePage = (req, res) => {
  const subject = req.params.subject;
  const weekSelected = parseInt(req.params.week);

  Subjects.findOne({name: subject}).then((data, error)=>{
      if(error){
        console.log("Data retrival Failed");
        console.log(error);
        res.redirect('/users/dashboard');
      }
      else{
        let topicsList = data.topics;
        
        // Map the topics to their corresponding weeks
        const map = new Map();

        topicsList.forEach(element=>{
            const elementsWeek = parseInt(element.weekNumber);
            if(map.get(elementsWeek) == undefined){
              map.set(elementsWeek, new Array());
            }
            map.get(elementsWeek).push(element);
        })
        const totalWeeks = map.size;
        topicsList = map.get(weekSelected);
        console.log('Map',map);
        console.log('For', weekSelected, 'Topics Are', topicsList);
        res.render('users/coursePage.ejs', {user: req.user, subject: subject, weekSelected: weekSelected, topicsList: topicsList, totalWeeks: totalWeeks  });
      }
  });
}



const getEnrolledCoursesPage = (req, res) => {
  Subjects.find().then((data)=>{
    const allSubjects = data;
    registeredSubjects.findOne({email: req.user.email}, (error, registeredSubjectsListData)=>{
        if(error){
          console.log("DataBase Error. Subjects Junction Table: NO DATA\n");
          res.redirect("/users/dashboard");
        }
        else{
          const registeredSubjectsList = registeredSubjectsListData.subjects;

          const subjectsToDisplay = innerUnion(allSubjects, registeredSubjectsList);

         
          res.render("users/enrolledCoursesListPage.ejs", { user: req.user,  subjectsList: subjectsToDisplay});        
        }
    })
    
  }).catch((error)=>{
      console.log(error);
      res.render("users/enrolledCoursesListPage.ejs", { user: req.user,  subjectsList: []});    }
  )
  
}

const unregisterCourse = (req, res) => {
    const eMail = req.user.email;
    const subjectName = req.params.subject;
    registeredSubjects.findOne({email: eMail}, (error, registeredSubjectsListData)=>{
      if(error){
        console.log("DataBase Error. Subjects Junction Table: NO DATA\n");
        res.redirect("/users/dashboard");
      }
      else{
        
        registeredSubjects.updateOne( {email: eMail}, { $pull: {subjects: {name: subjectName} } }, (error, succ)=>{
          if(error){
            console.log("Error Found\n");
            res.redirect("/users/enrolledcourselist"); 
          }
          else{
            res.redirect("/users/enrolledcourselist"); 
          }
        });
      }
  });
  
}

const getQuizInfoPage = (req, res) => {
  const subjectChosen = req.params.subject;
  var SubjectList = [];
  Subjects.find().then((data) => {
      SubjectList = data;
      if(subjectChosen == '--'){
        res.render("users/quizInfoPage.ejs", {
          user: req.user,
          SubjectList: SubjectList,
          chosenSubject: subjectChosen,
          topicsList: []
        });
        return;
      }
      let subjectTouple;
        SubjectList.forEach(subject=>{
          if(subject.name == subjectChosen){
              subjectTouple = subject;
          }
        })
        res.render("users/quizInfoPage.ejs", {
          error: req.flash('error'),
          user: req.user,
          SubjectList: SubjectList,
          chosenSubject: subjectChosen,
          topicsList: subjectTouple.topics
    });

  }).catch(() => {
    res.render("users/quizInfoPage.ejs", {
      user: req.user,
      SubjectList: SubjectList,
      chosenSubject: [],
      topicsList: []
    });
});
}


const postQuizInfoPage = (req, res) => {
  const {subjectname, topicname} = req.body;
  console.log({subjectname, topicname});

  res.redirect('/users/quizapp/' + subjectname + '&' + topicname);
  
}

const getQuiz = (req, res) => {
    const subjectname = req.params.subject;
    const topicname = req.params.topic;

    if(topicname == 'All Topics'){
      QuestionBank.find({subject:subjectname}).then((data,error)=>{
        if(error){
           console.log('error while fetching')
           res.render("users/giveQuizPage.ejs", {
             user: req.user,
             questionsList: []
           });   
        }
        else{
           console.log('question fetching')
           let questionsList = [];
 
           data.forEach(element=>{
             questionsList.push(element.questions);
           })
           
           // Covenrt to 1D array
           questionsList = [].concat(...questionsList);;
 
           console.log("questions:", questionsList);
 
           res.render("users/giveQuizPage.ejs", {
               user: req.user,
               questionsList: questionsList
           });
        }
      })
      return;
    }

     QuestionBank.find({subject:subjectname, topic: topicname}).then((data,error)=>{
       if(error){
          console.log('error while fetching')
          res.render("users/giveQuizPage.ejs", {
            user: req.user,
            questionsList: []
          });   
       }
       else{
          console.log('question fetching')
          let questionsList = [];

          data.forEach(element=>{
            questionsList.push(element.questions);
          })
          
          // Covenrt to 1D array
          questionsList = [].concat(...questionsList);;

          console.log("questions:", questionsList);

          res.render("users/giveQuizPage.ejs", {
              user: req.user,
              questionsList: questionsList
          });
       }
     })
}



const getuserInfoUpdate = (req, res) => {
  
  res.render("users/userInfoUpdate.ejs",{ user: req.user});   

}




module.exports = {
    getLogin,
    getRegister,
    postLogin,
    postRegister,
    getDashboard,
    getSearchPage,
    getCoursePage,
    enrollUser,
    getEnrolledCoursesPage,
    unregisterCourse,
    getQuizInfoPage,
    postQuizInfoPage,
    getQuiz,
    getuserInfoUpdate,

};